# Rule-authoring guide

How to add a new rule to LeaseGuard's rule pack. Rules live in
`app/src/rules/packV1.ts` as a flat `Rule[]`. Each rule is a plain data
object — no code — so rule review doesn't require a TS background.

## Shape of a rule

```ts
interface Rule {
  id: string;            // stable kebab-case id; used as the dedupe key in diffFindings
  severity: Severity;    // 'high' | 'medium' | 'low' | 'info'
  category: Category;    // 'termination' | 'fees' | 'dispute' | 'liability'
                         // | 'finance' | 'obligations' | 'general'
  title: string;         // short human-readable name shown in the findings panel
  explanation: string;   // legal-ish "what to check" copy
  citation: string | null; // statute / article ref, if any
  match: Matcher;        // how to find it

  // Optional fields (all additive; any rule without them still parses):
  jurisdictions?: string[]; // e.g. ["US-CA", "UK-ENG"]; empty/absent = everywhere
  plainEnglish?: string;    // reader-friendly summary, 1-2 sentences, ≤ 500 chars
  suggestedEdit?: string;   // neutral replacement clause text for the counter-offer library
}
```

All 10 built-in rules in `src/rules/packV1.ts` populate `plainEnglish`
and `suggestedEdit`; prefer doing the same for new rules.

## Matcher cookbook

LeaseGuard ships three matcher types. Pick the cheapest one that can do
the job; falling back to regex is a last resort. All three are dispatched
by `runMatcher` in `src/rules/matchers.ts` and share the
`CompiledMatcherCache` optimization (see below).

### 1. `keywordProximity` — use this first

Best when the clause uses predictable terminology but variable phrasing.
All keywords must appear within `window` characters of each other in the
*same paragraph*.

```ts
{
  id: 'attorney-fees',
  severity: 'medium',
  category: 'dispute',
  title: 'Attorney fees',
  explanation: 'Loser of any dispute must pay the other side\u2019s legal bills.',
  citation: null,
  match: {
    type: 'keywordProximity',
    keywords: ['attorney', 'fees'],   // case-insensitive
    window: 40,                        // chars between first and last keyword
  },
}
```

- Default confidence: **0.75**.
- Use this when a simple `X NEAR Y` pattern captures the clause.
- Pick keywords that won't false-match in boilerplate.

### 2. `regex` — use when wording is anchor-like

Use a regex when the clause has distinctive boilerplate — specific
multi-word phrases, numeric patterns, etc.

```ts
{
  id: 'auto-renewal',
  severity: 'medium',
  category: 'termination',
  title: 'Auto-renewal clause',
  explanation: 'Lease renews automatically unless you send written notice by a deadline.',
  citation: null,
  match: {
    type: 'regex',
    pattern: '\\bauto(?:matic(?:ally)?)?[- ]?renew(?:al|s|ed)?\\b',
    flags: 'i',
  },
}
```

- Default confidence: **0.9**.
- `pattern` is a serialized string (no slashes); `flags` is the usual
  regex flag string. The matcher forces the `g` flag internally — don't
  bake it into `flags`.
- Only the **first** hit per paragraph is returned.
- Use `\\b` word boundaries generously.

### 3. `sectionAnchored` — use to reduce false positives

Wrap a leaf matcher (regex or keywordProximity) and restrict it to
paragraphs inside a section whose heading matches `headingPattern`.

```ts
{
  id: 'arbitration-in-disputes-section',
  severity: 'high',
  category: 'dispute',
  title: 'Arbitration required for disputes',
  explanation: 'Disputes go to a private arbitrator instead of court.',
  citation: null,
  match: {
    type: 'sectionAnchored',
    headingPattern: 'dispute|arbitration',    // case-insensitive
    child: { type: 'regex', pattern: '\\b(?:binding\\s+)?arbitration\\b', flags: 'i' },
  },
}
```

- `headingPattern` is a regex tested with `i` flag against each
  section's heading text.
- Confidence is inherited from the child matcher.

## Optional fields

### `jurisdictions`

Array of jurisdiction codes. Empty or absent = applies everywhere. The
jurisdiction picker (`JurisdictionPickerPanel`) filters the active rule
set before passing it to `analyze`. Use codes like `"US-CA"`, `"UK-
ENG"`; the list of valid codes lives in `src/rules/jurisdictions.ts`.

### `plainEnglish`

A reader-friendly summary. Guidance:

- 1–2 sentences, ≤ 500 chars (enforced by the pack schema in
  `packSchema.ts`).
- Describe what the clause *does*, not whether it's bad. "Rent goes up
  every year by a set amount." — not "Predatory escalator."
- No legalese. Assume the reader has never signed a lease before.
- No second-person advice ("you should…"). The app lets the reader
  decide.

`FindingsPanel` renders this under the legal explanation as an
expandable "What this means" disclosure.

### `suggestedEdit`

A neutral, one-paragraph replacement clause. Consumed by the counter-
offer library (`src/negotiation/counterOffers.ts`) to pre-populate a
redline edit. When present, `FindingsPanel` can render an "Apply
suggestion" button that routes through `redlineStorage.saveEdit` and
fires a `redline-edit` audit entry.

Write the suggestion as if you were the tenant's counter-proposal —
plain, symmetrical language, no hostile framing.

## Negation awareness

The analyzer scans the 30 characters before each matched span for
negation tokens (`not`, `shall not`, `never`, `without`, `except`, …).
If any hit, the finding is still emitted but with `negated: true` and
confidence × 0.5. The UI renders a "(possibly not applicable)" badge.

You usually don't have to do anything. If you want to suppress a
specific false-negative case, the cleanest path is narrower keywords —
not special negation handling in the rule.

## Confidence

You don't set confidence directly. The matcher type sets a baseline
(regex 0.9, proximity 0.75, sectionAnchored inherits) and the analyzer
multiplies by 0.5 if the match is negated. Consumers see the final
number in `Finding.confidence` and in the JSON export.

## Compiled rules + per-pack cache

`src/rules/compileRules.ts` turns a `Rule[]` into a `CompiledRule[]`
whose `__compiled` field holds pre-built RegExp objects and lower-
cased keyword arrays. `analyze(doc, rules)` accepts either form — it
calls `isCompiledRules(rules)` and compiles inline if needed.

For rule-pack consumers, `src/rules/packStorage.ts` memoizes two ways:

- `getCompiledRulesForPack(pack)` — keyed by pack id, invalidated on
  `saveInstalledPack` / `setPackEnabled` / `deleteInstalledPack`.
- `getActiveCompiledRules(activeRules)` — `WeakMap` keyed on the
  identity of the caller's active-rules array. `usePipeline` memoizes
  `activeRules`, so repeated analyses reuse the same compiled cache.

You don't need to call either directly when authoring rules — but
know that `__compiled` is a runtime-only cache and must not be
persisted or sent across the worker boundary.

## Pack import / export

A rule pack file is a JSON document matching the schema in
`src/rules/packSchema.ts` (`leaseguard.rulepack.v1`). Imports arrive
as either:

1. **Plain pack JSON** — validated by `validatePackFile`, then stored
   via `saveInstalledPack`.
2. **Signed envelope** (`SignedPackEnvelope`) — `{ payload, signature,
   publicKey, algorithm: 'Ed25519' }`. Envelopes route through
   `packStorage.saveSignedPack(envelope, pack)`, which calls
   `verifySignedPack` before writing. A verify failure rejects without
   touching the store; success records the envelope in the
   `signatures` store with `status: 'verified'`, and the UI renders a
   trust badge via `getPackSignatureStatus(packId)`.

To sign your own pack, see `rules/packSigning.ts`: `signPack(pack,
privateKey, publicKey)` serializes the pack as canonical JSON (sorted
keys, no whitespace — same canonicalization as the audit log), signs
with Ed25519, and returns an envelope carrying an SPKI-encoded public
key. Trust policy (whose key is trusted) is outside the MVP.

## Checklist for a new rule

1. Append the rule to `src/rules/packV1.ts` (include `plainEnglish` and
   `suggestedEdit` when you can).
2. Add a positive-case line to the parameterized test in
   `src/rules/packV1.test.ts` (the `cases` array).
3. Add a snippet of the rule's real-world phrasing to the benign
   control test if you're worried about false positives.
4. If the rule is a realistic addition for one of the golden leases in
   `src/rules/golden.test.ts`, update that file's expectations too. If
   it's specifically residential or commercial, also update the
   "not-in-other-direction" assertion.
5. Run `npm test` and `npm run test:coverage`.

## Anti-patterns to avoid

- **Rules that match their own title.** Positive-case test against a
  *real-sounding* lease sentence.
- **Single-keyword proximity.** `keywordProximity` with one keyword is
  equivalent to a substring match — use regex instead to make intent
  obvious.
- **Overfitting to one phrasing.** If your regex has seven alternations
  in it, you're probably encoding test cases. Stop and look at whether
  `keywordProximity` is a better fit.
- **Silent catch-all `info` severity.** If a rule is worth showing, it's
  worth a real severity. `info` is reserved for strictly advisory items.
- **Judgmental `plainEnglish`.** Describe; don't advise.

## Canonical multi-feature regression check

`app/src/golden/commercial.golden.test.ts` is the canonical multi-feature
regression check. It exercises `parseLease`, `analyze`, `extractLeaseFacts`,
table extraction, and the cross-reference resolver simultaneously against a
synthetic enterprise commercial lease (built by `buildEnterpriseCommercialPdf()`
in `src/parser/testFixtures.ts`). Pinned counts assert ≥3 tables, ≥6
defined terms, ≥4 cross-references, and exactly 4 `RentSchedulePeriod`
entries — any parser change that drops a feature on this fixture must
update the snapshot deliberately, not silently regress.

## Rule pack version

Bump `RULE_PACK_VERSION` in `src/rules/analyze.ts` whenever the set of
emitted findings changes. It's stamped onto every `Finding` and appears
in the JSON export. Use semver: new rule = minor, behavior change on
existing rule = patch, pack-wide restructure = major.
