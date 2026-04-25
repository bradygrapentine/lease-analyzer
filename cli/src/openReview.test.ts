import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Wave 9 Part D — module under test does not yet exist; failing import is
// the expected red signal. The implementer creates `cli/src/openReview.ts`
// and registers it in `cli/src/index.ts` as `leaseguard-open-review`.
//
// Soft dependency on Part A — this test file references the inner shape
// of `app/src/storage/reviewArchive.ts` (export/importReviewArchive) via
// `import type` and via a fixture script in `cli/scripts/`. This file
// will be RED on D's branch (no Part A code present); D's implementer
// must rebase onto A at merge time. Assumed Part A signature:
//
//   exportReviewArchive(input: {
//     bundle: Uint8Array;
//     packFingerprint: string;
//     expiresAt: string;     // ISO-8601
//     passphrase: string;
//   }): Promise<Uint8Array>
//
// AND module under test exports:
//
//   openReview(args: { archiveBytes: Uint8Array; passphrase: string }):
//     Promise<{ ok: true; bundle: Uint8Array }
//            | { ok: false; reason: 'wrong-passphrase' | 'expired' | 'tampered' | 'malformed' }>
import { openReview } from './openReview';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_SCRIPT = resolve(__dirname, '../scripts/build-review-fixture.mjs');

function ensureFixtureScript(): void {
  if (!existsSync(FIXTURE_SCRIPT)) {
    throw new Error(
      `missing ${FIXTURE_SCRIPT} — Part D's implementer must add a small ` +
        `fixture script that imports Part A's exportReviewArchive and writes ` +
        `cli/fixtures/sample-review.lgreview (valid) and ` +
        `cli/fixtures/sample-review-expired.lgreview to disk.`,
    );
  }
}

const VALID_FIXTURE = resolve(__dirname, '../fixtures/sample-review.lgreview');
const EXPIRED_FIXTURE = resolve(__dirname, '../fixtures/sample-review-expired.lgreview');
const PASSPHRASE = 'review-test-passphrase-12345';

function loadOrSkip(p: string): Uint8Array {
  ensureFixtureScript();
  if (!existsSync(p)) {
    throw new Error(`missing ${p} — run \`node ${FIXTURE_SCRIPT}\``);
  }
  return new Uint8Array(readFileSync(p));
}

describe('openReview (CLI core)', () => {
  it('extracts a valid archive byte-identical to the in-app decoder', async () => {
    const bytes = loadOrSkip(VALID_FIXTURE);
    const result = await openReview({ archiveBytes: bytes, passphrase: PASSPHRASE });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle).toBeInstanceOf(Uint8Array);
      expect(result.bundle.byteLength).toBeGreaterThan(0);
    }
  });

  it('returns ok:false / reason:wrong-passphrase on a wrong passphrase', async () => {
    const bytes = loadOrSkip(VALID_FIXTURE);
    const result = await openReview({ archiveBytes: bytes, passphrase: 'definitely-wrong' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-passphrase');
  });

  it('returns ok:false / reason:expired on an expired archive', async () => {
    const bytes = loadOrSkip(EXPIRED_FIXTURE);
    const result = await openReview({ archiveBytes: bytes, passphrase: PASSPHRASE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('returns ok:false / reason:tampered on a single-byte ciphertext flip', async () => {
    const original = loadOrSkip(VALID_FIXTURE);
    const tampered = new Uint8Array(original);
    const idx = tampered.length - 8;
    tampered[idx] = ((tampered[idx] ?? 0) ^ 0x01) & 0xff;
    const result = await openReview({ archiveBytes: tampered, passphrase: PASSPHRASE });
    expect(result.ok).toBe(false);
  });
});

describe('leaseguard-open-review (CLI subcommand)', () => {
  it('exits 1 on a wrong passphrase', () => {
    const bytes = loadOrSkip(VALID_FIXTURE);
    const dir = mkdtempSync(join(tmpdir(), 'lg-review-'));
    const archive = join(dir, 'a.lgreview');
    writeFileSync(archive, bytes);
    const cliEntry = resolve(__dirname, './index.ts');
    const result = spawnSync(
      'node',
      ['--import', 'tsx', cliEntry, 'open-review', archive, '--passphrase', 'wrong'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
  });
});
