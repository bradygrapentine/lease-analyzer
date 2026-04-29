import { describe, expect, it } from 'vitest';
import { computeShortFingerprint, computeShortFingerprintFromBase64 } from './fingerprint';

describe('computeShortFingerprint', () => {
  it('returns the first 4 bytes of SHA-256 as 8 lowercase hex chars', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    // First 4 bytes -> "e3b0c442"
    const fp = await computeShortFingerprint(new Uint8Array(0));
    expect(fp).toBe('e3b0c442');
  });

  it('returns 8 hex chars for any input', async () => {
    const fp = await computeShortFingerprint(new Uint8Array([1, 2, 3, 4, 5]));
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic for identical inputs', async () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const a = await computeShortFingerprint(bytes);
    const b = await computeShortFingerprint(bytes);
    expect(a).toBe(b);
  });

  it('changes when any byte of the input changes', async () => {
    const a = await computeShortFingerprint(new Uint8Array([1, 2, 3]));
    const b = await computeShortFingerprint(new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
  });
});

describe('computeShortFingerprintFromBase64', () => {
  it('matches the raw-bytes fingerprint of the decoded value', async () => {
    const raw = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    const b64 = btoa('hello');
    const expected = await computeShortFingerprint(raw);
    expect(await computeShortFingerprintFromBase64(b64)).toBe(expected);
  });
});
