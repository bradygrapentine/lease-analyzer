import { describe, it, expect } from 'vitest';
// Wave 9 Part A — module under test does not yet exist. The failing import
// is the expected red signal until the implementer creates
// `app/src/storage/reviewArchive.ts` exporting:
//
//   exportReviewArchive(input: {
//     bundle: Uint8Array;          // a Wave 8 replay bundle
//     packFingerprint: string;     // hex sha-256 of the signed pack
//     expiresAt: string;           // ISO-8601
//     passphrase: string;
//   }): Promise<Uint8Array>        // an AES-GCM envelope (PBKDF2-derived key)
//
//   importReviewArchive(bytes: Uint8Array, passphrase: string, opts?: {
//     now?: Date;
//   }): Promise<{ bundle: Uint8Array; packFingerprint: string; expiresAt: string }>
//
//   The envelope must carry { packFingerprint, expiresAt, ciphertext, iv,
//   salt, version } and be tamper-evident via AES-GCM auth tag.
import {
  exportReviewArchive,
  importReviewArchive,
} from './reviewArchive';

const PASSPHRASE = 'correct horse battery staple';
const FUTURE_EXPIRY = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 60_000).toISOString();
const FAKE_FINGERPRINT = 'a'.repeat(64);

function bundle(): Uint8Array {
  return new TextEncoder().encode('PKfake-replay-bundle-bytes');
}

describe('reviewArchive', () => {
  it('round-trips: encrypt → decrypt yields a byte-identical inner bundle', async () => {
    const inner = bundle();
    const envelope = await exportReviewArchive({
      bundle: inner,
      packFingerprint: FAKE_FINGERPRINT,
      expiresAt: FUTURE_EXPIRY,
      passphrase: PASSPHRASE,
    });
    expect(envelope).toBeInstanceOf(Uint8Array);
    const opened = await importReviewArchive(envelope, PASSPHRASE);
    expect(opened.bundle).toEqual(inner);
    expect(opened.packFingerprint).toBe(FAKE_FINGERPRINT);
    expect(opened.expiresAt).toBe(FUTURE_EXPIRY);
  });

  it('rejects an expired archive with a clear error', async () => {
    const envelope = await exportReviewArchive({
      bundle: bundle(),
      packFingerprint: FAKE_FINGERPRINT,
      expiresAt: PAST_EXPIRY,
      passphrase: PASSPHRASE,
    });
    await expect(importReviewArchive(envelope, PASSPHRASE)).rejects.toThrow(/expired/i);
  });

  it('rejects a wrong passphrase (AES-GCM auth failure)', async () => {
    const envelope = await exportReviewArchive({
      bundle: bundle(),
      packFingerprint: FAKE_FINGERPRINT,
      expiresAt: FUTURE_EXPIRY,
      passphrase: PASSPHRASE,
    });
    await expect(importReviewArchive(envelope, 'wrong passphrase')).rejects.toThrow();
  });

  it('rejects a malformed envelope (bytes do not begin with the magic / shape)', async () => {
    const garbage = new Uint8Array(64).fill(0x42);
    await expect(importReviewArchive(garbage, PASSPHRASE)).rejects.toThrow();
  });

  it('rejects a tampered envelope (single bit flip in the ciphertext)', async () => {
    const envelope = await exportReviewArchive({
      bundle: bundle(),
      packFingerprint: FAKE_FINGERPRINT,
      expiresAt: FUTURE_EXPIRY,
      passphrase: PASSPHRASE,
    });
    const tampered = new Uint8Array(envelope);
    const idx = tampered.length - 8;
    tampered[idx] = ((tampered[idx] ?? 0) ^ 0x01) & 0xff;
    await expect(importReviewArchive(tampered, PASSPHRASE)).rejects.toThrow();
  });
});
