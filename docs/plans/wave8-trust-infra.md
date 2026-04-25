# Wave 8 — Trust infrastructure

**Goal:** turn the existing trust primitives (Ed25519 pack signing, signed
JSON reports, hash-chained audit log, replay bundles) into an ecosystem
a third party can audit. Wave 8 ships the four pillars of Phase 17: a
curated offline pack marketplace, an explicit "deviates from verified"
signal, an out-of-browser reproducibility CLI, and a key-rotation
workflow that preserves historical verifiability.

## Pre-flight

1. Wave 7 is fully merged (no open `wave7-*` branches on remote, ROADMAP shows Phase 6 Done).
2. `cd app && npm run typecheck && npm run lint && npm test` is green.
3. `docs/SYSTEM_DESIGN.md` privacy contract still reads "no network egress after load" — Wave 8 must not regress that, including the marketplace (build-time bundled, never fetched).

## Parts (parallel-safe)

### Part A — Offline pack marketplace

**Branch:** `wave8-marketplace`

**Files:**
- `app/public/packs/curated/` (new dir) — 3+ curated `.lgpack.json` files, each Ed25519-signed by a build-time author key
- `app/public/packs/curated/manifest.json` (new) — typed listing: `{ id, name, description, jurisdictions[], author, fingerprint, path }[]`
- `app/scripts/build-curated-packs.mjs` (new) — regenerates curated packs + manifest at postinstall
- `app/src/rules/curatedPacks.ts` (new) — pure loader that reads `manifest.json` via `fetch('/packs/curated/manifest.json')` (same-origin, CSP-clean) and returns typed entries
- `app/src/ui/MarketplacePanel.tsx` (new) — list view + verified badge + per-pack "Install" + per-pack "View diff vs current"
- `app/src/ui/MarketplacePanel.test.tsx` (new)
- `app/src/ui/MarketplacePanel.stories.tsx` (new)
- `app/src/ui/PackManagerPanel.tsx` — add "Browse included packs" link/section that mounts MarketplacePanel
- `docs/RULES.md` — document curated-pack authoring + signing ceremony

**Tests / verify:**
- `MarketplacePanel.test.tsx`: ≥ 6 cases (loading, loaded, install success, install failure, diff preview, signature-invalid badge).
- `curatedPacks.test.ts`: manifest parse, malformed entries rejected.
- `build-curated-packs.mjs` is idempotent — running twice produces byte-identical output.
- Lighthouse PWA score not regressed (precache still bounded — assert curated dir size in `check:budget`).

**Out of scope:** in-app pack authoring publish flow, network-fetched marketplace, multi-author trust hierarchy.

### Part B — Diff-vs-verified warnings

**Branch:** `wave8-deviation-warnings`

**Files:**
- `app/src/rules/packBaseline.ts` (new) — for any active rule, resolve its signed baseline (if any) via `getPackSignatureStatus`, return `{ id, baselineFingerprint, currentFingerprint, deviates: boolean }`
- `app/src/rules/packBaseline.test.ts` (new)
- `app/src/rules/types.ts` — `Finding` gets optional `deviation?: { fromFingerprint: string }`
- `app/src/ui/FindingsPanel.tsx` — render a "deviates from verified pack" badge when `finding.deviation` is set
- `app/src/ui/FindingsPanel.test.tsx` — add 2 cases (badge shown / not shown)
- `app/src/storage/exportReport.ts` — include `deviations: BaselineDeviation[]` in the signed JSON envelope
- `app/src/storage/exportReport.test.ts` — round-trip the new field

**Tests / verify:**
- Deviation detected when: (a) signed pack imported then a rule edited locally, (b) unsigned pack derived from a signed one (hash mismatch on rule body).
- Deviation NOT detected when: (a) rule unchanged, (b) pack never had a signed baseline.
- Visual: badge has `aria-label="Deviates from verified baseline"` for a11y.

**Out of scope:** machine-readable provenance trail, in-app "revert to baseline" action, pack-level deviation summary panel.

### Part C — Reproducibility CLI

**Branch:** `wave8-cli`

**Files:**
- `cli/` (new top-level dir, sibling to `app/`)
- `cli/package.json` — Node-only deps: nothing browser-specific; reuse `app/src/rules/*` and `app/src/parser/*` via path aliasing in `cli/tsconfig.json`
- `cli/src/index.ts` — `leaseguard-verify <replay-bundle.zip>` command; exits 0 on byte-identical reproduction, exits 1 with diff on mismatch
- `cli/src/verifyReplay.ts` — pure function: extract bundle, run `parseLease` + `analyze`, compare expected vs actual JSON
- `cli/src/verifyReplay.test.ts` — uses the same fixtures as `app/src/reproducibility.test.ts`
- `cli/README.md` — usage, no-network claim, deterministic-only guarantee
- `.github/workflows/cli.yml` (new) — typecheck + test on PR
- Root `package.json` workspaces field if not already configured

**Tests / verify:**
- CLI test runs against a checked-in replay bundle fixture (`cli/fixtures/sample-replay.zip` produced by `app/scripts/...`).
- Exit code 0 on success, 1 on intentional perturbation (modify finding text, expect mismatch).
- `cli/dist/` builds via `tsc` — no Vite, no browser polyfills.
- Importing `cli/src/verifyReplay.ts` MUST NOT pull in `pdf.js` worker code paths (ensure node-side parser entry).

**Out of scope:** CLI npm publishing, fancy diff output (plain text is fine), parallelism across multiple bundles.

### Part D — Key-rotation workflow

**Branch:** `wave8-key-rotation`

**Files:**
- `app/src/security/signingKeys.ts` — extend store schema: `keys: { id, createdAt, retiredAt: number | null, publicKey, wrappedPrivateKey }[]`; `getActiveKey()` + `rotateKey(passphrase)` + `listKeys()`
- `app/src/security/signingKeys.test.ts` — rotate + sign with new + verify old still valid
- `app/src/audit/auditLog.ts` — entry shape gains `signedByKeyId: string`; old entries default to `'k0'` for back-compat
- `app/src/audit/auditLog.test.ts` — chain still verifies across a rotation
- `app/src/ui/SigningKeyPanel.tsx` — "Rotate key" button + key history list with retired-at + per-key fingerprint
- `app/src/ui/SigningKeyPanel.test.tsx` — rotate UX, history rendering, can-still-verify-old assertion
- `docs/SYSTEM_DESIGN.md` — add "Key rotation" subsection: hash chain stays intact, retired keys remain usable for verification but not signing

**Tests / verify:**
- Rotate then sign a new audit entry: chain hash links across the boundary.
- Verify a pre-rotation entry succeeds against the retired pubkey.
- Re-rotate: 3 keys total, oldest still verifiable.
- Storage migration: existing single-key v1 records are reshaped into the multi-key v2 layout without data loss.

**Out of scope:** automatic rotation policy (cron-style), revocation lists, escrow.

## Merge order

A, B, C are fully independent. D touches `signingKeys.ts` which Part B's
exportReport.ts may also touch (signature path). Land D last, rebase to
pick up whatever exportReport changes shipped in B.

## Done definition

- All four PRs merged.
- ROADMAP Phase 17 moves from "Forward phase" to "Done"; new phases (if any) added.
- BACKLOG gains Phase 17 section with all four items ticked + footprint refreshed.
- A new `docs/REPRODUCIBILITY.md` (one page) describes how an external auditor would verify a signed report end-to-end using the CLI.
- Privacy contract in SYSTEM_DESIGN.md re-affirmed: zero network egress, including marketplace.
