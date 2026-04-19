import { describe, it, expect } from 'vitest';
import { sha256Hex } from './inputHash';

describe('sha256Hex', () => {
  it('returns the canonical SHA-256 for an empty input', async () => {
    const hex = await sha256Hex(new Uint8Array());
    // Canonical SHA-256 of the empty byte sequence.
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns the canonical SHA-256 for "abc"', async () => {
    const bytes = new TextEncoder().encode('abc');
    const hex = await sha256Hex(bytes);
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is 64 lowercase hex characters', async () => {
    const hex = await sha256Hex(new TextEncoder().encode('hello world'));
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await sha256Hex(new TextEncoder().encode('lease a'));
    const b = await sha256Hex(new TextEncoder().encode('lease b'));
    expect(a).not.toBe(b);
  });

  it('is stable for the same input across calls', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const a = await sha256Hex(bytes);
    const b = await sha256Hex(bytes);
    expect(a).toBe(b);
  });
});
