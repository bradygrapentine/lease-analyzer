# Rule-authoring guide

How to add a new rule to LeaseGuard's rule pack. Rules live in
`app/src/rules/packV1.ts` as a flat `Rule[]`. Each rule is a plain data
object — no code — so rule review doesn't require a TS background.

## Shape of a rule

```ts
interface Rule {
  id: string;           // stable kebab-case id; used as the dedupe key in diffFindings
  severity: Severity;   // 'high' | 'medium' | 'low' | 'info'
  category: Category;   // 'termination' | 'fees' | 'dispute' | 'liability' | 'finance' | 'obligations' | 'general'
  title: string;        // short human-readable name shown in the findings panel
  explanation: string;  // plain-language "what to check" copy
  citation: string | null; // statute / article ref, if any
  match: Matcher;       // how to find it
}
```

## Matcher cookbook

LeaseGuard ships three matcher types. Pick the cheapest one that can do
the job; falling back to regex is a last resort.

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
- Pick keywords that won't false-match in boilerplate (`"attorney"` alone
  hits the "notices" section; pair it with `"fees"` to anchor).

### 2. `regex` — use when wording is anchor-like

Use a regex when the clause has distinctive boilerplate — specific multi-word
phrases, numeric patterns, etc.

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
- `pattern` is a serialized string (no slashes); `flags` is the usual regex
  flag string. The matcher compiles with the `g` flag internally — don't
  bake it into `flags`.
- Only the **first** hit per paragraph is returned, so paragraph-level
  rules don't double-count.
- Use `\\b` word boundaries generously. Write patterns that read like
  English: `auto-renew` with optional hyphens and suffixes.

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
    headingPattern: 'dispute|arbitration',    // matches section heading, case-insensitive
    child: { type: 'regex', pattern: '\\b(?:binding\\s+)?arbitration\\b', flags: 'i' },
  },
}
```

- Useful when a keyword appears benignly elsewhere (e.g. `"arbitration"`
  may appear in a notice clause). The section anchor stops the false hit.
- `headingPattern` is a regex tested with `i` flag against each section's
  heading text.

## Negation awareness

The analyzer scans the 30 characters before the matched span for negation
tokens (`not`, `shall not`, `never`, `without`, `except`, …). If any hit,
the finding is still emitted but with `negated: true` and confidence × 0.5.
The UI renders a "(possibly not applicable)" badge.

You usually don't have to do anything. If you want to suppress a specific
false-negative case, the cleanest path is narrower keywords — not special
negation handling in the rule.

## Confidence

You don't set confidence directly. The matcher type sets a baseline, and
the analyzer multiplies by 0.5 if the match is negated. Consumers see the
final number in `Finding.confidence` and in the JSON export.

If you *want* to bias toward high-precision rules, prefer regex or a
tight-window keywordProximity (≤ 30 chars).

## Checklist for a new rule

1. Append the rule to `src/rules/packV1.ts`.
2. Add a positive-case line to the parameterized test in
   `src/rules/packV1.test.ts` (the `cases` array). A single sentence
   that the rule should fire on.
3. Add a snippet of the rule's real-world phrasing to the benign
   control test if you're worried about false positives.
4. If the rule is a realistic addition for one of the golden
   leases in `src/rules/golden.test.ts`, update that file's
   expectations too. If it's specifically residential or commercial,
   also update the "not-in-other-direction" assertion.
5. Run `npm test` and `npm run test:coverage`.

## Anti-patterns to avoid

- **Rules that match their own title.** E.g. `keywords: ['auto-renew']` —
  the rule's title is "Auto-renewal" which is what appears in the PDF
  text. Fine for identity, but don't chain it into a phrase that also
  appears in the preamble. Always positive-case test against a
  *real-sounding* lease sentence.
- **Single-keyword proximity**. `keywordProximity` with one keyword is
  equivalent to a substring match — use regex instead to make intent
  obvious.
- **Overfitting to one phrasing**. If your regex has seven alternations
  in it, you're probably encoding test cases. Stop and look at whether
  `keywordProximity` is a better fit.
- **Silent catch-all `info` severity**. If a rule is worth showing, it's
  worth a real severity. `info` is reserved for strictly advisory items.

## Rule pack version

Bump `RULE_PACK_VERSION` in `src/rules/analyze.ts` whenever the set of
emitted findings changes. It's stamped onto every `Finding` and appears
in the JSON export — downstream tools use it to decide whether a diff is
meaningful. Use semver: new rule = minor, behavior change on existing
rule = patch, pack-wide restructure = major.
