#!/usr/bin/env node
/**
 * Wave 9 Part D — review-archive fixture builder.
 *
 * Generates two byte-stable fixtures consumed by
 * `cli/src/openReview.test.ts`:
 *   - `cli/fixtures/sample-review.lgreview`         — valid, far-future expiry
 *   - `cli/fixtures/sample-review-expired.lgreview` — same key/iv/salt but
 *     `expiresAt` set to 1970-01-01 so the opener rejects it.
 *
 * To stay self-contained on D's branch (Part A's `reviewArchive.ts` is
 * not yet merged), this script encodes the envelope using the same
 * AES-GCM-256 + PBKDF2-SHA256 parameters that `openReview.ts` decodes.
 * Once Part A lands, replace the inline encoder here with an import of
 * `app/src/storage/reviewArchive.ts::exportReviewArchive` so the
 * fixture and the in-app encoder share one codepath.
 *
 * Run:
 *   node cli/scripts/build-review-fixture.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, pbkdf2Sync } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');
const VALID_OUT = resolve(FIXTURES, 'sample-review.lgreview');
const EXPIRED_OUT = resolve(FIXTURES, 'sample-review-expired.lgreview');

const PASSPHRASE = 'review-test-passphrase-12345';
const PACK_FINGERPRINT =
  'sha256:0000000000000000000000000000000000000000000000000000000000000001';

// Deterministic salt + iv keep the fixture byte-stable across regenerations.
const SALT = Buffer.from('00112233445566778899aabbccddeeff', 'hex'); // 16 bytes
const IV = Buffer.from('0102030405060708090a0b0c', 'hex'); // 12 bytes

// Inner replay-bundle stand-in. Part A wraps the real replay-bundle bytes
// here; for the CLI's purposes any non-empty payload is fine. We use a
// short ASCII placeholder so the test can confirm `bundle.byteLength > 0`
// without depending on the full app pipeline.
const INNER_BUNDLE = Buffer.from(
  'leaseguard-review-fixture-v1\n' +
    'This payload stands in for the real replay-bundle bytes that\n' +
    'Part A wraps. The CLI only needs a non-empty plaintext to assert\n' +
    'a successful round-trip; once Part A merges, swap this for a real\n' +
    `buildReplayBundle() output.\n`,
  'utf8',
);

function buildEnvelope({ expiresAt }) {
  const key = pbkdf2Sync(
    Buffer.from(PASSPHRASE, 'utf8'),
    SALT,
    210_000,
    32,
    'sha256',
  );
  const cipher = createCipheriv('aes-256-gcm', key, IV);
  const head = cipher.update(INNER_BUNDLE);
  const tail = cipher.final();
  const tag = cipher.getAuthTag();
  // Match WebCrypto convention: auth tag appended to ciphertext.
  const ciphertext = Buffer.concat([head, tail, tag]);

  // Stable key order keeps the JSON byte-stable.
  const envelope = {
    v: 1,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iter: 210_000,
    salt: SALT.toString('base64'),
    iv: IV.toString('base64'),
    packFingerprint: PACK_FINGERPRINT,
    expiresAt,
    ciphertext: ciphertext.toString('base64'),
  };
  return Buffer.from(JSON.stringify(envelope), 'utf8');
}

await mkdir(FIXTURES, { recursive: true });

const validBytes = buildEnvelope({ expiresAt: '2099-12-31T23:59:59.000Z' });
await writeFile(VALID_OUT, validBytes);
process.stdout.write(`Wrote ${VALID_OUT} (${validBytes.byteLength} bytes)\n`);

const expiredBytes = buildEnvelope({ expiresAt: '1970-01-01T00:00:00.000Z' });
await writeFile(EXPIRED_OUT, expiredBytes);
process.stdout.write(`Wrote ${EXPIRED_OUT} (${expiredBytes.byteLength} bytes)\n`);
