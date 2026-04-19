import { describe, it, expect } from 'vitest';
import { copyBytes } from './copyBytes';

describe('copyBytes', () => {
  it('returns a byte-equal copy', () => {
    const src = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const copy = copyBytes(src);
    expect(Array.from(copy)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('allocates a fresh underlying ArrayBuffer', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    const copy = copyBytes(src);
    expect(copy.buffer).not.toBe(src.buffer);
    expect(copy.byteOffset).toBe(0);
    expect(copy.byteLength).toBe(src.byteLength);
  });

  it('mutating the copy does not affect the source', () => {
    const src = new Uint8Array([1, 2, 3]);
    const copy = copyBytes(src);
    copy[0] = 99;
    expect(src[0]).toBe(1);
  });

  it('mutating the source does not affect the copy', () => {
    const src = new Uint8Array([1, 2, 3]);
    const copy = copyBytes(src);
    src[0] = 99;
    expect(copy[0]).toBe(1);
  });

  it('handles empty arrays', () => {
    const src = new Uint8Array(0);
    const copy = copyBytes(src);
    expect(copy.byteLength).toBe(0);
    expect(copy.buffer).not.toBe(src.buffer);
  });

  it('copies only the view window, not the whole backing buffer', () => {
    // A Uint8Array view over a subrange of a larger ArrayBuffer must still
    // copy only the view, not the full parent buffer.
    const parent = new Uint8Array([10, 20, 30, 40, 50]);
    const view = parent.subarray(1, 4); // [20, 30, 40]
    const copy = copyBytes(view);
    expect(Array.from(copy)).toEqual([20, 30, 40]);
    expect(copy.byteLength).toBe(3);
    expect(copy.buffer.byteLength).toBe(3);
  });

  it('surviving a pdf.js-style detach leaves the copy intact', () => {
    // Simulate ArrayBuffer transfer by posting the source to a worker-like
    // MessageChannel that takes ownership. After transfer the source view is
    // zero-length, but the copy we keep must still be readable.
    const src = new Uint8Array([1, 2, 3, 4]);
    const copy = copyBytes(src);
    try {
      // structuredClone with a transfer list detaches the source buffer.
      structuredClone(src.buffer, { transfer: [src.buffer] });
    } catch {
      // Some runtimes don't support transfer; skip the assertion here.
      return;
    }
    expect(src.byteLength).toBe(0);
    expect(Array.from(copy)).toEqual([1, 2, 3, 4]);
  });
});
