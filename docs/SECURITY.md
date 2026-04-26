# Security

LeaseGuard is a local-first PWA: after the initial app load there is no
network egress. The threat model below is therefore narrow — it covers
the artifacts a user can choose to share off-device (encrypted archives,
diagnostics JSON, signed reports) and the supply-chain trust assumptions
the build pipeline depends on. Everything else is "data on disk under
the user's OS account" and inherits that trust boundary.

This document is the authoritative reference for the four risk-register
items closed out in Wave 11 (see `docs/BACKLOG.md` → "Known unknowns &
risk register"). When a related design changes, update the matching
section here in the same PR.

**Last review:** 2026-04-25 (Wave 16-F).

Findings from the 2026-04-25 pass:

- `npm audit --audit-level=high` was reporting 4 HIGH findings via
  `vite-plugin-pwa → workbox-build → @rollup/plugin-terser →
  serialize-javascript@<=7.0.4` (RCE via `RegExp.flags` /
  `Date.prototype.toISOString`, plus a CPU-DoS). Pinned via the new
  `overrides.serialize-javascript: ^7.0.5` block in `app/package.json`.
  All four HIGHs cleared; 9 MODERATEs remain in the Storybook /
  vite-plugin-pwa transitive tree (build-time only, not shipped to
  end users — track for routine maintenance, not blocking).
- A03 Injection: zero `dangerouslySetInnerHTML` callers in `app/src`.
- A05 Misconfiguration: `npm run check:csp` clean; CSP in
  `app/index.html` is `default-src 'self'` with `style-src 'self'
  'unsafe-inline'` (React inline styles), `connect-src 'self' blob:`
  (worker postMessage), `worker-src 'self' blob:`, and `object-src
  'none'`. No external origins.
- A02 Crypto: encrypted-archive AES-GCM uses a fresh `randomBytes`
  IV per encryption (`app/src/storage/archive.ts:28`); Ed25519 keys
  go through `crypto.subtle.generateKey` and the private key never
  leaves IDB unencrypted (Wave 8-D's `signingKeys.ts`). No regressions
  vs. the Wave 8-D baseline.
- A08 Integrity: SHA-256 via `crypto.subtle` is the single content
  fingerprinting source (`app/src/security/inputHash.ts`); no parallel
  hashing implementations.

---

## 1. Encrypted archive threat model

### What the format protects

Encrypted archives (`leaseguard-archive-v1`, used by the review-link and
backup flows) wrap the archive payload with AES-GCM-256 using a key
derived from a user-supplied passphrase via PBKDF2-HMAC-SHA256, **200 000
iterations**, with a per-archive 16-byte random salt and a 12-byte random
IV. The `LGv1` magic header pins the format version.

### Adversary

The assumed adversary is an opportunistic attacker with the archive
file but no side-channel access to the user's machine — e.g. an email
recipient, a leaked Dropbox link, or someone who finds the file on a
shared drive. They have offline access only. We do not defend against
attackers with code execution on the user's device, kernel-level
privilege, or live observation of the WebCrypto worker.

### Why PBKDF2 200k (as of 2026-04-25)

PBKDF2-HMAC-SHA256 at 200 000 iterations is OWASP's 2023 recommended
floor and is the strongest KDF available in WebCrypto without pulling
in a WASM dependency. It is GPU-friendly, which is its main weakness:
a determined attacker with a high-end GPU can mid-six-figure-guess
passwords per second offline. We mitigate this with the existing
**passphrase strength UI** (zxcvbn-style guidance at archive-export
time, surfaced in `ArchiveExportPanel`), which pushes users toward
passphrases that survive that throughput.

### Argon2id — explicit deferral

Argon2id is the modern best practice (memory-hard, GPU-resistant) but
WebCrypto does not implement it; shipping Argon2id would require either
a ~50 KiB hand-rolled implementation or a WASM dependency
(`argon2-browser` is ~250 KiB).

**Decision (2026-04-25):** stay on PBKDF2 200k for v1; revisit Argon2id
on **2026-10-01**. Trigger conditions for an earlier revisit:
- WebCrypto ships native Argon2id support in any major browser, OR
- a mid-size WASM Argon2id (<30 KiB) lands in the npm ecosystem with
  a permissive license, OR
- the OWASP recommendation for KDFs raises the PBKDF2 floor.

The revisit is tracked in `docs/BACKLOG.md` under the risk register.

### Format-version contract

The `LGv1` magic + explicit `kdf` / `iterations` fields in the archive
header mean we can ship a v2 format that uses Argon2id without breaking
existing archives — old archives stay readable as long as the v1 KDF
code path is retained. Plan future format bumps as additive, not
replacing.

---

## 2. Crash-log / diagnostics contents

`recordCrash` (in `app/src/observability/crashLog.ts`) keeps a
20-entry in-memory ring buffer of caught exceptions. The "Download
diagnostics" button on the Error Boundary fallback emits a JSON blob
(`leaseguard-diagnostics-YYYY-MM-DD.json`, schema
`leaseguard.diagnostics.v1`).

The Error Boundary now renders a **"What's in the diagnostics file"**
disclosure above the download button — sourced from
`diagnosticsSummary()` so the UI and the payload cannot drift. As of
Wave 11 the categories are:

- `userAgent` — the browser's `navigator.userAgent` string. May reveal
  browser version, OS, and (on some Linux distros) locale hints.
- `stack-traces (last 20)` — the ring buffer. Stack frames are file
  paths inside the bundled SPA (e.g. `index-abc123.js:1:4567`); they
  do **not** contain absolute filesystem paths from the user's machine.
  React's `componentStack` is included when available.
- `rule-pack versions` — the `RULE_PACK_VERSION` constant and any
  imported pack ids. Public information by design.
- `no PDF bytes` — explicitly: the JSON contains zero bytes from any
  uploaded lease.
- `no IDB contents` — explicitly: the JSON contains no IndexedDB
  contents (no saved leases, redlines, audit log, signing keys,
  archives, annotations, packs, counter-offers, or version history).

If any of these change, update both the `diagnosticsSummary()` array
and this section in the same PR. The
`crashLog.test.ts` suite asserts the array contents byte-for-byte, so
the test will fail loud if the contract drifts.

### Sharing guidance

The diagnostics file is safe to share with a maintainer for bug
reports. If the user has reproduced a crash by interacting with a
specific lease, the stack trace can encode the **shape** of the trigger
(e.g. the rule id whose matcher threw) but not the lease text itself.

---

## 3. CSP contract + the `check:csp` build gate

### Runtime contract

`app/index.html` sets:

```
Content-Security-Policy: default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:;
  font-src 'self' data:; connect-src 'self' blob:;
  worker-src 'self' blob:; object-src 'none'; base-uri 'self';
  form-action 'none'; frame-ancestors 'none'
```

This is the Phase 0 / Phase 6 promise: zero third-party origins, no
inline scripts, no eval. Workers and blob URLs are permitted because
the PWA ships `pdf.worker`, the lease-analysis Web Worker, and the
tesseract worker — all served same-origin.

### Build-time gate (`npm run check:csp`)

A CSP header alone is a runtime guard — a CDN URL pulled in by a
dependency upgrade would still ship to users (they'd just see a
console error on first install). `app/scripts/check-csp.mjs` closes
that gap by scanning `dist/index.html` and `dist/sw.js` after
`npm run build` for:

- `<script src=...>` / `<link href=...>` / `<img src=...>`
- CSS `url(...)` references
- `importScripts(...)` calls in the service worker

Any URL with an explicit external scheme (`http:`, `https:`, `ws:`,
`ftp:`, …) or a protocol-relative `//host/...` form fails the build.
`data:`, `blob:`, `mailto:`, `#anchor`, absolute same-origin paths
(`/foo`), and bare relative paths are allowed.

CI runs the gate on every PR, immediately after `npm run build` and
before `npm run check:budget`. See `.github/workflows/ci.yml`.

If you legitimately need an external asset, **bundle it locally** —
extend `scripts/build-tesseract-assets.mjs` for the canonical pattern
(copy from `node_modules` at install time into `public/`).

### Test fixtures

`app/scripts/check-csp.test.mjs` covers:
- happy path (clean `dist/index.html` + `dist/sw.js`),
- planted CDN URLs across each pattern (script src, link href, CSS
  `url()`, `importScripts`, protocol-relative `//cdn.example.com/x.js`),
- the multi-source aggregator.

This test is the regression fixture; we never mutate real source files
to "see if the gate fires."

---

## 4. Rule-pack rot review

### What "rot" means here

The 10 v1 rules in `app/src/rules/packV1.ts` were hand-authored at the
project's start. Three risks accumulate over time:

1. **Field drift** — a future edit silently drops `plainEnglish` or
   `suggestedEdit` (both optional on the `Rule` type but populated for
   every v1 rule), degrading the FindingsPanel disclosure / counter-offer
   pre-fill UX.
2. **Pattern drift** — case law, common lease boilerplate, or the
   golden-lease fixtures evolve and the matcher's positive cases no
   longer cover what's on the ground.
3. **Tone drift** — `plainEnglish` strings drift from the project's
   "neutral, no jurisdiction claims, no legal advice" voice.

### Review cadence

| Cadence | Item | Owner |
|---|---|---|
| Every PR that touches `packV1.ts` | Run `npm test -- packV1` and `npm test -- golden`. The Wave 11 rot-review block in `packV1.test.ts` asserts `plainEnglish` and `suggestedEdit` are present and non-empty for every rule. | PR author |
| Quarterly (next: **2026-07-25**) | Manual read-through of all v1 rules: tone, accuracy, suggested-edit text. Update `RULE_PACK_VERSION` if any content changes. | Maintainer |
| Annually (next: **2027-04-25**) | Re-run the full golden-lease suite against the live rule pack and a freshly-collected sample of public commercial + residential leases. Decide whether to retire / split / merge any rule. | Maintainer |

The rot-review test block is the automated tripwire; the quarterly +
annual cadences are the human review the test cannot replace. When a
review pass completes, append a `Decision:` line to the
`docs/BACKLOG.md` risk-register entry rather than removing the bullet
— the audit trail matters more than the line count.

## 5. Third-party assets and licensing

### What we redistribute

LeaseGuard's CSP is `default-src 'self'`, which means every runtime
asset must be served from the app's own origin. The OCR feature is the
only place where this forces us to redistribute third-party binaries
inside the PWA bundle:

- `app/public/tesseract/worker.min.js` (tesseract.js, Apache-2.0)
- `app/public/tesseract/tesseract-core.wasm` and
  `app/public/tesseract/tesseract-core.wasm.js` (tesseract.js-core,
  Apache-2.0)
- `app/public/tesseract/<code>.traineddata.gz` for every entry in
  `app/public/tesseract/languages.json` (tessdata_fast, Apache-2.0)

All four asset families are Apache-2.0. Apache-2.0 §4(d) requires that
distributions include a copy of the upstream NOTICE attributions; none
of the upstreams publish a separate NOTICE file, but we still need to
preserve the copyright + license-pointer text.

### How we satisfy Apache-2.0 §4(d)

`app/public/NOTICE` enumerates each asset, its upstream, version, and
the Apache-2.0 attribution text. The file is precached by the service
worker and reachable at `/NOTICE` from any installed instance of the
PWA. `README.md` cross-references it from the OCR feature paragraph;
this section cross-references it from the security/threat-model side.

### What counts as "redistribution" for a precached PWA

A user installing LeaseGuard as a PWA (`Add to home screen`) receives a
local copy of every precached asset, including the tesseract binaries
and `/NOTICE`. That installation is a redistribution under Apache-2.0
§4 — the licence obligations attach to the installed copy, not to the
HTTP fetch from the host. As long as `/NOTICE` is present in the
precache manifest and reachable from the installed PWA, §4(d) is
satisfied.

### Re-review trigger

Re-review this section AND `app/public/NOTICE` whenever any of the
following changes:

1. A new tesseract trained-data file is added to
   `app/public/tesseract/` (new language).
2. `tesseract.js` or `tesseract.js-core` is bumped past a major
   version, or replaced with a different WebAssembly OCR engine.
3. A new third-party runtime asset of any kind is precached by the
   service worker (icon font, model file, etc.).

Routine patch-version bumps of the existing eng-only tesseract bundle
do not require a re-review — they ship the same Apache-2.0 obligations
the NOTICE already attributes. The unit test in
`app/src/security/notice.test.ts` asserts that the NOTICE file is
reachable at build time and contains the expected attribution
strings; a refactor that drops or empties the file fails CI.

## 6. Versioning + signed-format compatibility

The signed-findings envelope is identified by
`EXPORT_SCHEMA = 'leaseguard.findings.v1'` in
`app/src/storage/exportReport.ts`. The signature covers the canonical
2-space-indented `JSON.stringify` of the payload with the `signature`
field stripped. The signing key is Ed25519; the public key is the raw
32-byte key encoded as base64 inside `SignatureBlock.publicKey`.

### v1 payload shape (pinned)

The fields under the `v1` signature, exactly as `exportFindingsJson`
emits them:

- `schema: 'leaseguard.findings.v1'`
- `lease: { name, pageCount, paragraphCount, sectionCount }`
- `inputHash: string | null`
- `rulePackVersion: string | null`
- `findings: Array<{ ruleId, severity, category, title, explanation,
  citation, page, snippet, span, confidence, negated }>` —
  `confidence` is rounded to 2 decimal places before signing
- `deviations: Array<{ id, baselineFingerprint, currentFingerprint,
  deviates }>`

The `signature` block (`{ publicKey, signature, signedAt }`) is
appended **after** signing and is not itself covered by the signature.
`verifySignedExport` re-canonicalizes by stripping `signature` and
re-running `JSON.stringify(rest, null, 2)`.

### Triggers for cutting `v2`

Bump `EXPORT_SCHEMA` to `leaseguard.findings.v2` whenever **any** of
the following change:

1. The set of top-level keys in the payload (adding `tenant`,
   removing `deviations`, renaming any of the above).
2. The shape of any nested object or array element under the
   signature — including additive fields on `findings[*]` or
   `deviations[*]`. There is no backward-compatible change to a
   signed payload; any change to the bytes-under-signature is a new
   envelope version.
3. The canonicalization rules: indent width, key ordering, number
   serialization (e.g., changing `confidence` rounding precision),
   line-ending convention.
4. The signature algorithm (Ed25519 → anything else) or the public-key
   encoding (raw 32-byte / base64 → SPKI / hex / etc.).
5. The `SignatureBlock` shape.

When `v2` ships, `verifySignedExport` must dispatch on the `schema`
field and keep the `v1` verifier code path indefinitely. Existing
`v1` exports on user devices must remain verifiable forever — old
exports are evidence; rotating them out is not an option.

### What this section pins

This is the policy companion to the operational rules in
[`RELEASING.md`](./RELEASING.md). `RELEASING.md` says **when** to
bump versions; this section says **what compatibility guarantee** the
signed-export bump implies. They must move together: a `v2` envelope
PR must update both files in the same change.
