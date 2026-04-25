# Reproducibility — verifying a LeaseGuard report end-to-end

LeaseGuard's analysis is deterministic. Given the same lease bytes and the
same rule pack, the same set of findings comes out — and a third party can
verify that without running the browser app. This document is the
auditor's checklist.

## What you need

- `report.signed.json` — the exported, Ed25519-signed analysis envelope
  (Phase 12, "Export signed JSON report").
- `bundle.replay.zip` — the replay bundle the user exported alongside the
  report. Contains `lease.pdf`, the rule pack at the time of analysis,
  and the expected findings JSON (Phase 12, "Replay bundle export").
- The signer's public key — the user can paste it from
  `SigningKeyPanel`'s "Export public key" button. Wave 8-D added a key
  history; pre-rotation reports verify against the matching retired key,
  not the current active one (`signedByKeyId` on each audit entry tells
  you which).
- Node ≥ 20 and the `cli/` workspace from this repo.

## The verification

```sh
cd cli
npm install
npx tsx src/index.ts /path/to/bundle.replay.zip
```

Exit code semantics:

| Exit | Meaning |
| ---- | ------- |
| 0    | Replay reproduced byte-identical findings. The report is faithful. |
| 1    | Mismatch. CLI prints the diff between expected and actual JSON. |

The CLI does the same work the in-app `reproducibility.test.ts` does, but
out of the browser:

1. Extract the bundle (pure node `storeZipReader`, CRC-checked).
2. Re-parse `lease.pdf` via `pdfjs-dist/legacy/build/pdf.mjs` — node
   build, no worker, no network.
3. Re-run `analyze(LeaseDocument, RulePack)` from `app/src/rules/`.
4. Canonicalize both findings sets and compare.

## Verifying the signed report itself

The CLI verifies *reproduction*. To verify the *signature* on
`report.signed.json`, use any Ed25519-aware tool — the JSON envelope's
`signature` field is base64; the canonical payload is everything except
that field, serialized via the same canonical-JSON helper used in
`app/src/storage/exportReport.ts`. A 30-line node script using
`crypto.verify('ed25519', ...)` is sufficient.

For audit-log chains, `app/src/audit/auditLog.ts` exports
`verifyAuditChain` which is pure and reusable from node. Each entry's
`signedByKeyId` (defaulting to `'k0'`) tells you which historical key
should verify it; the chain itself only covers `{seq, timestamp, kind,
payload, prevHash}`, so adding the key-id field is back-compat with
pre–Wave 8 entries.

## The privacy contract this preserves

- The CLI is filesystem-only. No network egress at any step.
- The replay bundle contains exactly what the user chose to share — no
  telemetry, no IDB dump, no key material.
- Rotated signing keys never leave the user's device; only public keys
  are exported. Verification of historical reports works against the
  retired public key.

## What the marketplace adds

Wave 8-A ships build-time-curated `.lgpack.json` packs under
`app/public/packs/curated/`, each Ed25519-signed by a
`build-curated-packs.mjs`-managed author key. The marketplace UI shows
the verified-author badge that Phase 10 built. Curated-pack signatures
are reproducible: `npm run build:curated-packs` regenerates them with
byte-identical output.

If a user edits a curated rule, Wave 8-B's `packBaseline` resolver
flags the deviation in `FindingsPanel` and on the signed export
(`deviations[]` field). Auditors get a machine-readable signal that the
rule body diverges from the verified baseline.
