/**
 * Return a deep copy of `bytes` backed by a fresh `ArrayBuffer`.
 *
 * pdf.js' `getDocument({ data })` transfers ownership of the underlying
 * ArrayBuffer — after the call, the original `Uint8Array` is detached and
 * unreadable. Anywhere we hand bytes to pdf.js we must hand it a copy, or a
 * later render/parse/OCR pass over the same source will fail.
 *
 * Using `new Uint8Array(source)` is almost equivalent, but it defers on a
 * SharedArrayBuffer input by aliasing the same buffer. This helper always
 * allocates a new `ArrayBuffer` and does a byte-for-byte memcpy via `.set`,
 * guaranteeing the returned view is fully independent of the input.
 */
export function copyBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}
