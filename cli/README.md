# `leaseguard` — reproducibility + share-link CLI

The `leaseguard` CLI lets a third party (auditor, regulator, paranoid
tenant) verify a LeaseGuard analysis without trusting the browser app.
Two subcommands ship today:

- `leaseguard verify <replay-bundle.zip>` — re-runs `parseLease +
  analyze` on a `.replay.zip` and proves the bundled `expected.json` is
  the byte-identical output (Wave 8 Part C).
- `leaseguard open-review <archive.lgreview> --passphrase <pp> [--out
  <path>]` — decrypts a share-link archive and extracts the inner
  replay bundle (Wave 9 Part D). Pipe the result into `verify` to do a
  full end-to-end reproducibility check on a received lease.

## Guarantees

- **No network egress.** The CLI never opens a socket. All inputs come
  from the bundle on disk; all dependencies are vendored under
  `node_modules`.
- **Deterministic-only.** The analysis pipeline (`parseLease` →
  `analyze`) is byte-stable across runs; if the produced findings JSON
  diverges from `expected.json`, the bundle is flagged as not
  reproducible.
- **Pure node.** No browser polyfills, no DOM, no PDF.js worker spawn —
  the legacy `pdfjs-dist` build runs synchronously in node.

## Usage

```bash
# verify (Wave 8 Part C)
node cli/dist/cli/src/index.js verify <path/to/your.replay.zip>

# open-review (Wave 9 Part D)
npx tsx cli/src/index.ts open-review <path/to/share.lgreview> \
  --passphrase '<the-passphrase>' \
  --out /tmp/extracted.replay.zip

# end-to-end: decrypt then verify
npx tsx cli/src/index.ts open-review share.lgreview --passphrase 'pp' \
  --out /tmp/x.zip && \
  npx tsx cli/src/index.ts verify /tmp/x.zip
```

Exit codes (uniform across subcommands):
- `0` — success (bundle verified, or archive decoded and written).
- `1` — semantic failure: `verify` mismatch, or `open-review` returned
  `wrong-passphrase` / `expired` / `tampered` / `malformed`. The reason
  is printed to stderr.
- `2` — usage / IO error (missing file, missing `--passphrase`, bad
  CLI args).

## Build

```bash
cd cli
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npx tsc             # builds to cli/dist/
```

The CLI is plain TypeScript compiled by `tsc`; no Vite, no bundler.

## Fixtures

- `cli/fixtures/sample-replay.zip` — canonical replay bundle used by
  `cli/src/verifyReplay.test.ts`. Regenerate with
  `cli/node_modules/.bin/tsx cli/scripts/build-fixture.mjs`. The
  script uses the same code path the app uses (`buildReplayBundle`)
  on a small synthetic residential lease PDF produced by `pdf-lib`.
- `cli/fixtures/sample-review.lgreview` and
  `cli/fixtures/sample-review-expired.lgreview` — canonical share-link
  archives used by `cli/src/openReview.test.ts`. Regenerate with
  `node cli/scripts/build-review-fixture.mjs`. Both fixtures use a
  pinned salt + IV so the on-disk bytes stay stable across
  regenerations; the passphrase is `review-test-passphrase-12345`.

Regeneration is only required if the rule pack / parser pipeline
changes the deterministic output (for `sample-replay.zip`) or the
envelope schema changes (for `.lgreview`). The envelope shape is
documented in `docs/SYSTEM_DESIGN.md` ("Collaboration escape hatches").

## How it works

1. Read the bundle bytes from disk.
2. Parse the STORE-only zip in `cli/src/storeZipReader.ts` (cross-checks
   LFH/CDH metadata and verifies CRC-32 of every entry — any tamper is
   rejected).
3. Decode `lease.pdf`, `pack.lgpack.json`, `expected.json`.
4. Run `parseLease(pdf)` then `analyze(doc, rules)`.
5. Stable-stringify the produced findings (sorted object keys at every
   depth) and compare to the bundle's `expected.json.findings`.
6. Exit 0 if equal; otherwise emit a plain-text line diff and exit 1.

The stable-stringify mirrors the serializer in
`app/src/workflow/replayBundle.ts` so the comparison is apples-to-apples.

## Out of scope

- npm publishing of the CLI binary
- Fancy / structural diff output (plain text is sufficient for audit)
- Parallel verification of multiple bundles
- Signature verification of the bundle envelope (Wave 8 Part D adds
  signed reports; the CLI checks reproducibility, not signing).
