/**
 * Minimal STORE-only ZIP reader. Parses the End-Of-Central-Directory
 * record, walks the central directory, and yields each entry's name +
 * raw stored bytes. Compression methods other than STORE (0) are
 * rejected — replay bundles are produced by `app/src/workflow/storeZip`,
 * which only writes STORE.
 *
 * No external deps, no buffer pools, no streaming — fine for the
 * single-file CLI verifier. Browser-free, node-free (works either way).
 */

const SIG_LFH = 0x04034b50;
const SIG_CDH = 0x02014b50;
const SIG_EOCD = 0x06054b50;

export function extractStoreZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEocd(dv, bytes.byteLength);
  if (eocdOffset < 0) throw new Error('EOCD not found — not a ZIP file');

  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  const cdSize = dv.getUint32(eocdOffset + 12, true);
  const cdStart = dv.getUint32(eocdOffset + 16, true);
  if (cdStart + cdSize > bytes.byteLength) {
    throw new Error('Central directory extends past end of file');
  }

  const out = new Map<string, Uint8Array>();
  let cursor = cdStart;
  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(cursor, true) !== SIG_CDH) {
      throw new Error(`Bad central-directory signature at offset ${cursor}`);
    }
    const cdhStart = cursor;
    const method = dv.getUint16(cursor + 10, true);
    const compSize = dv.getUint32(cursor + 20, true);
    const uncompSize = dv.getUint32(cursor + 24, true);
    const nameLen = dv.getUint16(cursor + 28, true);
    const extraLen = dv.getUint16(cursor + 30, true);
    const commentLen = dv.getUint16(cursor + 32, true);
    const lfhOffset = dv.getUint32(cursor + 42, true);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    cursor += 46 + nameLen + extraLen + commentLen;

    if (method !== 0) {
      throw new Error(`Entry "${name}" uses compression method ${method}; STORE-only supported`);
    }
    if (compSize !== uncompSize) {
      throw new Error(`Entry "${name}" comp/uncomp size mismatch (STORE)`);
    }

    if (dv.getUint32(lfhOffset, true) !== SIG_LFH) {
      throw new Error(`Bad local-file-header signature for "${name}" at ${lfhOffset}`);
    }
    const lfhNameLen = dv.getUint16(lfhOffset + 26, true);
    const lfhExtraLen = dv.getUint16(lfhOffset + 28, true);
    // Cross-check LFH vs CDH: a tampered byte in either header should
    // surface as a mismatch. The writer emits identical metadata in
    // both headers, so any divergence means the archive was modified.
    const lfhMethod = dv.getUint16(lfhOffset + 8, true);
    const lfhModTime = dv.getUint16(lfhOffset + 10, true);
    const lfhModDate = dv.getUint16(lfhOffset + 12, true);
    const lfhCrc = dv.getUint32(lfhOffset + 14, true);
    const lfhCompSize = dv.getUint32(lfhOffset + 18, true);
    const lfhUncompSize = dv.getUint32(lfhOffset + 22, true);
    const cdhMethod = method;
    const cdhModTime = dv.getUint16(cdhStart + 12, true);
    const cdhModDate = dv.getUint16(cdhStart + 14, true);
    const cdhCrc = dv.getUint32(cdhStart + 16, true);
    if (
      lfhMethod !== cdhMethod ||
      lfhModTime !== cdhModTime ||
      lfhModDate !== cdhModDate ||
      lfhCrc !== cdhCrc ||
      lfhCompSize !== compSize ||
      lfhUncompSize !== uncompSize ||
      lfhNameLen !== nameLen
    ) {
      throw new Error(`LFH/CDH header mismatch for "${name}" — archive corrupted`);
    }
    const dataStart = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.byteLength) {
      throw new Error(`Entry "${name}" data extends past end of file`);
    }
    const data = bytes.subarray(dataStart, dataEnd);
    // Verify CRC32 of stored bytes matches the declared value. STORE
    // compression: stored bytes ARE the uncompressed payload.
    const actualCrc = crc32(data);
    if (actualCrc !== cdhCrc) {
      throw new Error(`CRC mismatch for "${name}" — archive corrupted`);
    }
    out.set(name, data);
  }
  return out;
}

// CRC-32/ISO-HDLC, poly 0xEDB88320 — matches the writer in
// `app/src/workflow/storeZip.ts`. Table built lazily.
let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

function crc32(bytes: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = t[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Scan backwards for the EOCD signature (no ZIP comment in our writer). */
function findEocd(dv: DataView, length: number): number {
  // EOCD is 22 bytes; the writer never appends a comment, so it's at
  // length - 22. Be defensive and scan the last 64 KiB anyway.
  const minStart = Math.max(0, length - (22 + 0xffff));
  for (let i = length - 22; i >= minStart; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}
