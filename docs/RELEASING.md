# Releasing LeaseGuard

Authoritative source of truth for when to bump versions, when to cut a
release, and what compatibility guarantees we promise. Cross-references
the implementation files so the rules don't drift.

## Versions we track

There are three independent version axes. Bumping one does not imply
bumping the others.

| Version | Lives in | Scheme | Bumps on |
|---|---|---|---|
| `RULE_PACK_VERSION` | `app/src/rules/analyze.ts` | semver | rule-pack content changes (see §1) |
| `app/package.json` `version` | `app/package.json` | semver | UX / schema / signed-format changes (see §2) |
| Tauri / PWA release tag | `git tag vX.Y.Z` | mirrors `app/package.json` | distribution events (see §3) |
| Signed-export envelope | `EXPORT_SCHEMA` in `app/src/storage/exportReport.ts` | `vN` integer suffix | format-breaking changes (see §4 and `SECURITY.md` §6) |

## 1. When to bump `RULE_PACK_VERSION`

`RULE_PACK_VERSION` ships in every `Finding`'s `rulePackVersion` field
and in the signed-export envelope. Older signed exports must remain
verifiable forever, so the version is meaningful, not cosmetic.

Bump `RULE_PACK_VERSION` when **any** of the following changes in
`app/src/rules/packV1.ts` (or any module the pack imports at compile
time):

- A matcher's regex, keyword set, or proximity threshold.
- A rule's `severity`, `category`, `plainEnglish`, or `suggestedEdit`.
- A rule's `id` (only ever via deprecation — see "id retirement"
  below; the bump is still required).
- The `Matcher` union itself (a new matcher type counts even if no
  existing rule uses it yet, because the compiled-rule cache shape
  changes).

Do **not** bump for:

- Test-only edits (`*.test.ts`, fixtures, golden assertions).
- Comment / docstring changes inside `packV1.ts`.
- Refactors of `compileRules.ts` or `matchers.ts` that don't change
  observable matcher output.

Scheme: semver. **Major** for any change that would make a previously-
matched finding stop matching (rule deletion, severity downgrade past
the export consumer's threshold, matcher semantics rewrite). **Minor**
for additive rule changes (new rule, expanded matcher coverage).
**Patch** for plainEnglish / suggestedEdit text-only edits.

### id retirement

A retired rule **id** is reserved forever. Never re-use it for a new
rule, even after a major bump. The signed-export envelope cites
findings by `ruleId`, so re-using an id would silently change what an
old export claims about a lease. Keep retired ids in a comment block
at the bottom of `packV1.ts` with the version they were retired in.

## 2. When to bump `app/package.json` version

Bump when any of the following ship to `main`:

- An additive UX change visible in a release-note bullet (new panel,
  new flag, new export format option).
- An IDB schema bump (any `_resetXDbForTests` test fixture also bumps
  the underlying `version` argument to `openDB`).
- The signed-export envelope schema changes — this also bumps
  `EXPORT_SCHEMA` per §4.
- The Tauri bundle config (`app/src-tauri/tauri.conf.json`) changes in
  a way that affects installed binary identity (productName,
  identifier, window title).

Do **not** bump for:

- Pure dev-dep additions (Storybook, eslint plugins).
- CI workflow edits.
- Doc-only PRs.
- Internal refactors with no surface-level effect.

Scheme: semver. **Major** for IDB schema breaks where existing
on-device data can't be migrated (this is a hard line we want to
avoid; prefer migrations). **Minor** for any new shipped surface.
**Patch** for bug fixes that change observable behavior but not
compatibility.

## 3. When to cut a release tag

A release tag (`vX.Y.Z` matching `app/package.json`) gates two
distribution events:

- A new `dist/` deploy of the PWA (auto-deploys today; the tag
  documents the snapshot).
- A new Tauri build of the `.deb` / `.app` / `.dmg` / `.msi` artifacts
  intended for distribution outside CI.

Tag when:

- `app/package.json` minor or major bumps (see §2).
- `RULE_PACK_VERSION` minor or major bumps that haven't shipped under
  a previous app-version tag (a content release).
- A security fix has landed (always tag, even on patch).

Do **not** tag for:

- CI / docs / test-infra-only PRs since the last tag.
- Patch app-version bumps that batch with another upcoming bump
  within the next merge window.

Release-note format: bulleted list keyed off the `wave-N` commit
messages already in `git log`. Pull from
`git log --oneline <previous-tag>..HEAD --grep="wave"` and curate.
Group bullets by category: **Rules**, **UX**, **Trust + privacy**,
**Performance**, **Build / CI**.

## 4. When to cut a new signed-export envelope (`v2`, `v3`, …)

The signed-export envelope is `EXPORT_SCHEMA = 'leaseguard.findings.v1'`
in `app/src/storage/exportReport.ts`. The signature covers the
canonical 2-space-indented JSON serialization with the `signature`
field stripped.

Bump the envelope (`v1` → `v2`) when **any** of the following changes:

- The set of fields covered by the signature (adding or removing a
  top-level key in the payload — `lease`, `inputHash`,
  `rulePackVersion`, `findings`, `deviations`, anything new).
- The canonicalization rules themselves (indent width, key ordering,
  number serialization, anything that affects the bytes the signature
  is computed over).
- The signature algorithm or key format (today: Ed25519 raw 32-byte
  public key, base64).
- The `SignatureBlock` shape (`publicKey`, `signature`, `signedAt`).

Do **not** bump the envelope for:

- Adding fields *inside* an existing array element (e.g., a new
  per-finding field) — that already breaks the signature, so it
  requires `v2`. (Said another way: there is no such thing as a
  backward-compatible add to a signed payload. Any payload change is
  a `v2`.)

Wait — that's the same trigger. The point is: there's no "soft" change
to a signed envelope. Either the bytes-under-signature are identical
or they're not. If they're not, it's a new envelope version.

Compatibility contract: `v1` exports must remain verifiable by the app
forever. `verifySignedExport` must dispatch on `schema` and keep the
v1 verifier code path indefinitely. Document the dispatch in
`docs/SECURITY.md` §6 when `v2` is cut.

## 5. Worked example

Suppose the next merge train looks like:

- Wave 16-A: adds three new rules to `packV1.ts`.
- Wave 16-B: adjusts `FindingsPanel` empty-state copy.
- Wave 16-C: bumps `tesseract.js` from 5.x to 6.x.

Bumps:

- `RULE_PACK_VERSION`: `1.0.0` → `1.1.0` (additive rules).
- `app/package.json`: `0.0.0` → `0.1.0` (UX surface — new rules
  are user-visible findings; minor bump).
- Release tag: `v0.1.0`, with notes citing the three wave commits.
- Signed-export envelope: unchanged (no envelope schema change).
- `SECURITY.md`: tesseract major bump triggers the §5 re-review per
  the existing trigger; that's a separate review, not a release-policy
  decision.

## 6. Cross-references

- `app/src/rules/analyze.ts` — `RULE_PACK_VERSION` literal.
- `app/src/storage/exportReport.ts` — `EXPORT_SCHEMA`,
  `signExport`, `verifySignedExport`.
- `docs/SECURITY.md` §6 — the signed-format compatibility section
  this file is the operational counterpart to.
- `docs/BACKLOG.md` — risk-register pointer to this doc.
