# System Design

LeaseGuard is a single-page PWA. Parsing, rule evaluation, persistence,
comparison, redlining, signing, and audit all run in the browser. There
is no backend and no network egress after load.

## Layering

```
   ┌───────────────────────────────────────────────────────────┐
   │                     React UI layer                        │
   │  App.tsx · usePipeline · panels (Findings / Portfolio /   │
   │  Redline / Pack / Audit / Facts / CounterOffer / Sign…)   │
   └────────────┬──────────────────────────────────────────────┘
                │ dispatches
                ▼
   ┌───────────────────────────────────────────────────────────┐
   │   Pipeline client (worker or inline fallback)             │
   │   parse-analyze request ⇄ LeaseDocument + Finding[]       │
   └────────────┬──────────────────────────────────────────────┘
                │
  ┌─────────────┼──────────────┐     ┌──────────────────────┐
  ▼             ▼              ▼     ▼                      │
 parser/     rules/          compare/   facts/              │
 parseLease  analyze         diffLeases extractFacts        │
              + compileRules  needsOcr  rentSchedule        │
                                                            │
 ┌──────────────────────────────────────────────────────────┤
 │   Persistence — 9 IndexedDB databases (see table below)  │
 │   storage/  rules/packStorage  annotations/  redline/…   │
 └──────────────────────────────────────────────────────────┤
                                                            │
 ┌──────────────────────────────────────────────────────────┤
 │   Cross-cutting: security/signingKeys (Ed25519)          │
 │                  rules/packSigning                       │
 │                  audit/auditLog (hash-chained)           │
 └──────────────────────────────────────────────────────────┘
```

Imports only reach "upward" or "leftward" in this diagram: `parser/` has
no `rules/` dependency, `rules/` has no `storage/` dependency, and
`audit/` is a leaf — everything may write to it, but it imports nothing
outside its own module.

## usePipeline state machine

`src/App/usePipeline.ts` owns the upload/analyze/save lifecycle. Status
transitions:

```
       ┌──────────┐
       │   idle   │◀───── reset() ─────┐
       └────┬─────┘                    │
            │ upload(bytes, name)      │
            ▼                          │
     ┌────────────┐   failure   ┌───────┴────┐
     │  loading   │────────────▶│   error    │
     └────┬───────┘             └────────────┘
          │ ok          ▲
          ▼             │
     ┌────────────┐  reanalyze()/ocr()
     │  analyzed  │──────┘
     │  + optional│    open(record)  ─▶ analyzed
     │  comparison│
     └────────────┘
```

Side effects on the `loading → analyzed` edge: the pipeline client's
`parseAndAnalyze` runs, `saveLease` persists the result, `onLibraryChange`
refreshes the caller's library view, and if a standard-lease pointer is
set to a different lease, the hook populates `comparison`. `reanalyze()`
re-runs `analyze(doc, rules)` over the currently-loaded document without
re-parsing; the jurisdiction picker and severity-override flows use this.

## Worker boundary

`src/worker/leaseWorker.ts` is a dedicated ES module Web Worker (Vite
emits it as a separate chunk; `worker: { format: 'es' }` in
`vite.config.ts`). The request protocol lives in `src/worker/types.ts`:

- `parse-analyze` — `{ id, bytes: Uint8Array, rules: Rule[],
  rulePackVersion? }`. Posted with `bytes.buffer` in the `transfer`
  list.
- Response — `{ id, ok: true, doc, findings }` or `{ id, ok: false,
  error, errorName? }`.

`createLeaseWorkerClient()` in `src/worker/leaseWorkerClient.ts` auto-
selects: real `Worker` when available, `createInlinePipelineClient()`
(the pre-Phase-13 main-thread path) otherwise. Tests inject a stub
through `usePipeline`'s `pipelineClient` option.

**Serialization contract.** `LeaseDocument`, `Rule`, and `Finding` are
plain data — structured-clone safe. `CompiledRule.__compiled` is a
runtime-only cache and is stripped / recomputed inside the worker.

## Data model

```ts
// parser/types.ts
TextItem { text, x, y, width, height, fontSize }
PageText { pageNumber, width, height, items }
Paragraph { text, page }
Section { heading, number, paragraphs, startPage }
LeaseDocument { pages, paragraphs, sections, raw }

// rules/types.ts
Rule {
  id, severity, category, title, explanation, citation, match,
  jurisdictions?, plainEnglish?, suggestedEdit?
}
Matcher = RegexMatcher | KeywordProximityMatcher | SectionAnchoredMatcher
Finding { ruleId, severity, category, title, explanation, citation,
          page, paragraphIndex, snippet, span, confidence, negated,
          rulePackVersion }

// storage/storage.ts
LeaseRecord { id, name, createdAt, updatedAt, rulePackVersion,
              pageCount, findingCount, doc, findings }
```

Matcher semantics:

| Type               | Confidence | Notes                                      |
|--------------------|-----------:|--------------------------------------------|
| `regex`            | 0.9        | First hit per paragraph; `g` flag forced.  |
| `keywordProximity` | 0.75       | All keywords in one paragraph within `window` chars. |
| `sectionAnchored`  | child's    | Child matcher run only under heading regex. |
| negation post-filter | × 0.5    | Snippet within 30 chars of `not`/`shall not`/etc. |

## Rule compilation + pack cache

`src/rules/compileRules.ts` turns a `Rule[]` into a `CompiledRule[]`
with a `__compiled` cache (pre-built RegExp, lower-cased keyword
lists). `analyze(doc, rules)` accepts either shape — plain rules get
compiled inline, already-compiled arrays skip the step.

`src/rules/packStorage.ts` keeps two memo layers:

- `packCompileCache` (`Map<packId, CompiledRule[]>`) — invalidated on
  `saveInstalledPack`, `setPackEnabled`, `deleteInstalledPack`. A
  re-analyze after a pack mutation picks up the new patterns on the
  next call.
- `activeRulesCache` (`WeakMap<Rule[], CompiledRule[]>`) — keyed on
  the identity of the caller's array (`usePipeline` memoizes its
  `activeRules`), so repeated analyses inside one render cycle reuse
  the same compiled form.

## IndexedDB landscape

Nine databases, each with an independent migration history and an
`_reset<Name>DbForTests` hook. Separation is deliberate: a schema bump
in one concern never forces a migration on another.

| DB name                    | Version | Stores                                     | Purpose |
|----------------------------|--------:|--------------------------------------------|---------|
| `leaseguard`               | v3      | `leases`, `settings`, `clauseTemplates`    | Primary lease library + standard-lease pointer + clause templates |
| `leaseguard-packs`         | v3      | `packs`, `enabled`, `settings`, `signatures` | Installed rule packs, enabled flags, jurisdiction / severity settings, signed-envelope records |
| `leaseguard-annotations`   | v1      | `annotations`                              | Per-paragraph user annotations |
| `leaseguard-counters`      | v1      | `counters`                                 | User's counter-offer library |
| `leaseguard-redlines`      | v1      | `edits`                                    | Redline paragraph replacements |
| `leaseguard-versions`      | v1      | `versions`                                 | Lease version snapshots |
| `leaseguard-audit`         | v1      | `entries`                                  | Append-only hash-chained audit log |
| `leaseguard-signing`       | v2      | `keypair`                                  | Ed25519 keypairs (multi-key, see "Key rotation"); private key passphrase-wrapped |
| `leaseguard-bulk-dedup`    | v1      | `hashes`                                   | SHA-256 content hashes for bulk-import dedup |

## Signing

`src/security/signingKeys.ts` manages a local Ed25519 keypair via
WebCrypto. The private key is wrapped at rest with AES-GCM + 200k
PBKDF2/SHA-256 keyed by the user's passphrase. Public key is stored
unwrapped.

Two consumers:

1. **Signed findings export** (`storage/exportReport.ts`) — JSON with
   `leaseguard.findings.v1` schema, accompanied by an Ed25519
   signature over canonical JSON of the payload.
2. **Signed pack envelopes** (`rules/packSigning.ts`) — `SignedPackEnvelope
   { payload, signature, publicKey, algorithm: 'Ed25519' }`. `payload`
   is canonical JSON of the `RulePackFile`. Imported `.lgpack.json`
   files may be plain-JSON packs or envelopes; envelopes route through
   `packStorage.saveSignedPack(env, pack)`, which verifies before
   writing and records the verify status in the `signatures` store.

Canonical JSON (sorted keys at every depth, no whitespace) is shared
with the audit log — see `canonicalJsonStringify` in `audit/auditLog.ts`.

### Key rotation

The signing store is multi-key (v2). Records are keyed by stable ids
(`k0`, `k1`, ...). The active key is the single record with
`retiredAt === null`; rotated-out keys are kept in the same store with
`retiredAt` set to the rotation timestamp.

- `getActiveKey()` — current signing key (used by all new signatures).
- `rotateKey(passphrase)` — generates a new Ed25519 keypair, marks the
  prior active key as retired, and returns the new key id + public key.
  The new key uses a freshly prompted passphrase; the prior passphrase
  is still required if the caller wants to re-sign with the retired key.
- `signWithKey(payload, passphrase, keyId)` — sign with a specific
  (typically retired) key. Used by audit-export verification paths.
- `listKeys()` — full history (active + retired) for the
  `SigningKeyPanel` history UI.

Retired keys remain usable for **verification** of historical
signatures but are never auto-selected for new signing. The v1 → v2
storage migration is lossless: the legacy single record (`id: 'active'`)
is rewritten as `k0` with `retiredAt: null`.

The audit log's hash chain stays intact across rotations because
`signedByKeyId` (the per-entry key id) is intentionally NOT covered by
`entryHash`. Pre-rotation entries verify against the retired key's
public key (looked up by `signedByKeyId`); post-rotation entries verify
against the new active key. Old entries that predate the field default
to `'k0'` for back-compat with v1 audit logs.

## Audit log

`src/audit/auditLog.ts` — append-only, hash-chained.

Each `AuditEntry` = `{ seq, timestamp, kind, payload, prevHash,
entryHash, signedByKeyId? }`. `entryHash` = SHA-256 of canonical JSON
over `{seq, timestamp, kind, payload, prevHash}` — `signedByKeyId` is
deliberately excluded so the field can be added back-compatibly without
breaking v1 chain verification. `prevHash` links to the tail of the
chain. `verifyAuditChain()` re-hashes every row and reports the first
gap or mismatch. New entries record the active signing-key id; legacy
entries with no `signedByKeyId` default to `'k0'` (see "Key rotation").

Writes fan out from `App.tsx`'s `safeAudit()` wrapper (try/catch;
console.warn on failure; never aborts the caller). Known event kinds:

`analyze`, `save-lease`, `delete-lease`, `export`, `import-pack`,
`pack-signature-verified`, `pack-signature-invalid`, `bulk-import`,
`version-save`, `version-restore`, `version-delete`, `redline-edit`,
`custom-rule-save`. `kind` is a free-form string; new call sites may
add more.

IDB + WebCrypto contract: don't `await subtle.digest` inside an open
IDB transaction (the microtask tick auto-commits). `appendAuditEntry`
reads the tail, hashes outside any tx, then writes in a short tx.

## Redline mode

Third view-toggle in `App.tsx` (`current` / `portfolio` / `redline`).
When active, the following panels render together:

- `RedlinePanel` — per-paragraph redline editor backed by
  `leaseguard-redlines`.
- `VersionHistoryPanel` — snapshot / restore / delete against
  `leaseguard-versions`.
- `SideLetterPanel` — collects negotiated deltas into a side letter.

Suggested-edit flow: a finding's rule may carry `suggestedEdit`.
`FindingsPanel` renders an "Apply suggestion" button when the parent
provides both `suggestedTextByRuleId` and `onApplySuggestion`. App
wires this to `redlineStorage.saveEdit` and fires a `redline-edit`
audit entry.

## Facts + plain English

- `src/facts/extractFacts.ts` — heuristic extraction of rent, term,
  notice periods, defined terms. Powers `LeaseFactsPanel`.
- `Rule.plainEnglish` (optional, ≤ 500 chars) — reader-friendly
  clause summary shown under the legal explanation.
- `Rule.suggestedEdit` (optional) — safe, neutral replacement text
  used by the counter-offer library.

## Bundle layout

Production build emits (rough sizes; see `BACKLOG.md`'s footprint
table for the authoritative figures):

- `index-*.js` — app shell + React + panels.
- `pdfjsApi-*.js` — pdf.js API chunk (lazy-loaded).
- `pdf.worker.*.js` — pdf.js worker; same-origin (no CDN).
- `leaseWorker-*.js` — dedicated parse+analyze worker chunk.
- `tesseract/*` — OCR runtime, copied from `node_modules` on
  `postinstall`, served same-origin. `eng.traineddata.gz` (language
  data) must be placed manually in `public/tesseract/` — we don't
  fetch it at install time.

## Privacy contract

- Strict CSP in `index.html`: `default-src 'self'; script-src 'self';
  connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none';
  form-action 'none'; frame-ancestors 'none'`.
- `vite-plugin-pwa` service worker precaches assets for offline use.
- Archive export/import uses WebCrypto AES-GCM. No handshake ever
  leaves the device.

## Collaboration escape hatches

Wave 9 adds three offline-first sharing surfaces. None of them open a
network socket; archives travel over user-initiated file export, and
recipients open them by drag/drop. The **review archive** (Part A) is
the foundational primitive:

- File extension: `.lgreview`. On-disk shape is a UTF-8 JSON envelope:
  `{ magic: "LGREVIEW", version: 1, packFingerprint, expiresAt, salt,
  iv, ciphertext }` with `salt`, `iv`, `ciphertext` base64-encoded so
  the CLI verifier (Part D) can read metadata without a binary parser.
- Encryption: AES-GCM, 256-bit key, fresh 12-byte random IV per
  archive. The 128-bit auth tag is the AES-GCM tag baked into the
  ciphertext output by WebCrypto — there is no separate HMAC. A
  single-bit flip anywhere in the ciphertext fails decrypt with an
  authentication error and the archive is rejected.
- Key derivation: PBKDF2-HMAC-SHA-256, 250 000 iterations, fresh
  16-byte random salt per archive. Salt is stored in the envelope; the
  passphrase is held only in memory and is never persisted.
- Expiry: ISO-8601 timestamp checked against `Date.now()` (or an
  injected `now` for tests) before decrypt is attempted. Expired
  archives surface a clear "expired" error.
- What is NOT included: telemetry, key escrow, IDB dumps beyond the
  chosen lease's replay bundle, network egress, server-side
  share-link hosting.
- Recipient trust model: the recipient sees a read-only review session;
  audit writes back to the original lease are gated off (Part B may
  route a separate "review-session" audit log). Possession of the
  passphrase + a matching signed pack is the only authentication.

## Performance

- 50-page parse budget 3s (CI measures ~210ms on the synthetic fixture).
- Virtualized `FindingsPanel` via `useInViewport` (IntersectionObserver
  with `rootMargin: '200px'`); placeholders pinned to measured height
  so scroll position stays stable.
- `renderPdfPages` accepts an `AbortSignal` so stale renders cancel
  when the viewer unmounts or switches documents.

## Known non-goals (for now)

Cloud sync, accounts, team collaboration, jurisdiction-specific legal
reasoning, LLM-based summarization. Tauri desktop wrapper has a `src-
tauri/` stub dir but no code.
