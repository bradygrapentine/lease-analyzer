# `leaseguard-verify` — reproducibility CLI

`leaseguard-verify` lets a third party (auditor, regulator, paranoid
tenant) re-run a LeaseGuard analysis from a `.replay.zip` bundle and
prove the bundled `expected.json` is the byte-identical output of
`parseLease + analyze` on the bundled `lease.pdf` with the bundled
`pack.lgpack.json`.

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
node cli/dist/cli/src/index.js <path/to/your.replay.zip>
# or, after `npm link` / install:
leaseguard-verify <path/to/your.replay.zip>
```

Exit codes:
- `0` — byte-identical reproduction. Bundle verifies.
- `1` — mismatch. A plain-text diff is written to stderr.
- `2` — usage error (missing file, unreadable bundle, bad CLI args).

## Build

```bash
cd cli
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npx tsc             # builds to cli/dist/
```

The CLI is plain TypeScript compiled by `tsc`; no Vite, no bundler.

## Fixture

`cli/fixtures/sample-replay.zip` is a checked-in canonical bundle used
by `cli/src/verifyReplay.test.ts`. Regenerate with:

```bash
cli/node_modules/.bin/tsx cli/scripts/build-fixture.mjs
```

The script uses the same code path the app uses
(`buildReplayBundle`) on a small synthetic residential lease PDF
produced by `pdf-lib`. Regeneration is only required if the rule pack
or parser pipeline changes the deterministic output.

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
