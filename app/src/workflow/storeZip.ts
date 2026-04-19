/**
 * Hand-rolled STORE-only ZIP writer (RFC-compatible enough for every
 * mainstream unzipper). No compression, no external dep.
 *
 * Shared primitive used by `buildHandoffZip` and `buildReplayBundle`.
 * STORE trades a few tens of KB on disk for zero added deps and a tiny
 * code footprint. See APPNOTE 4.3 for the spec.
 */

export interface StoreZipFile {
  /** Archive path, forward slashes. Encoded as UTF-8. */
  name: string;
  data: Uint8Array;
}

interface Entry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc32: number;
}

// Signatures (little-endian when written).
const SIG_LFH = 0x04034b50; // local file header
const SIG_CDH = 0x02014b50; // central directory header
const SIG_EOCD = 0x06054b50; // end of central directory

const VERSION_NEEDED = 20; // 2.0 — deflate/stored
const METHOD_STORE = 0;

export function buildStoreZip(files: StoreZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  const entries: Entry[] = files.map((f) => ({
    nameBytes: enc.encode(f.name),
    data: f.data,
    crc32: crc32(f.data),
  }));

  // Phase 1: compute total size to allocate one buffer.
  let lfhBytes = 0;
  let cdhBytes = 0;
  for (const e of entries) {
    lfhBytes += 30 + e.nameBytes.length + e.data.length;
    cdhBytes += 46 + e.nameBytes.length;
  }
  const total = lfhBytes + cdhBytes + 22; // 22 = EOCD
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  // Phase 2: write local file headers + payloads; remember offsets.
  const offsets: number[] = [];
  let cursor = 0;
  for (const e of entries) {
    offsets.push(cursor);
    // Local file header (30 bytes)
    dv.setUint32(cursor, SIG_LFH, true);
    dv.setUint16(cursor + 4, VERSION_NEEDED, true);
    dv.setUint16(cursor + 6, 0, true); // general-purpose flags
    dv.setUint16(cursor + 8, METHOD_STORE, true);
    dv.setUint16(cursor + 10, 0, true); // mod time (unused)
    dv.setUint16(cursor + 12, 0x21, true); // mod date (1980-01-01)
    dv.setUint32(cursor + 14, e.crc32, true);
    dv.setUint32(cursor + 18, e.data.length, true); // comp size
    dv.setUint32(cursor + 22, e.data.length, true); // uncomp size
    dv.setUint16(cursor + 26, e.nameBytes.length, true);
    dv.setUint16(cursor + 28, 0, true); // extra len
    cursor += 30;
    out.set(e.nameBytes, cursor);
    cursor += e.nameBytes.length;
    out.set(e.data, cursor);
    cursor += e.data.length;
  }

  // Phase 3: central directory.
  const cdStart = cursor;
  entries.forEach((e, i) => {
    dv.setUint32(cursor, SIG_CDH, true);
    dv.setUint16(cursor + 4, VERSION_NEEDED, true); // version made by
    dv.setUint16(cursor + 6, VERSION_NEEDED, true); // version needed
    dv.setUint16(cursor + 8, 0, true); // flags
    dv.setUint16(cursor + 10, METHOD_STORE, true);
    dv.setUint16(cursor + 12, 0, true); // mod time
    dv.setUint16(cursor + 14, 0x21, true); // mod date
    dv.setUint32(cursor + 16, e.crc32, true);
    dv.setUint32(cursor + 20, e.data.length, true); // comp
    dv.setUint32(cursor + 24, e.data.length, true); // uncomp
    dv.setUint16(cursor + 28, e.nameBytes.length, true);
    dv.setUint16(cursor + 30, 0, true); // extra
    dv.setUint16(cursor + 32, 0, true); // comment
    dv.setUint16(cursor + 34, 0, true); // disk number
    dv.setUint16(cursor + 36, 0, true); // internal attrs
    dv.setUint32(cursor + 38, 0, true); // external attrs
    dv.setUint32(cursor + 42, offsets[i]!, true); // LFH offset
    cursor += 46;
    out.set(e.nameBytes, cursor);
    cursor += e.nameBytes.length;
  });
  const cdSize = cursor - cdStart;

  // Phase 4: EOCD.
  dv.setUint32(cursor, SIG_EOCD, true);
  dv.setUint16(cursor + 4, 0, true); // disk number
  dv.setUint16(cursor + 6, 0, true); // disk with CD
  dv.setUint16(cursor + 8, entries.length, true); // entries on disk
  dv.setUint16(cursor + 10, entries.length, true); // total entries
  dv.setUint32(cursor + 12, cdSize, true);
  dv.setUint32(cursor + 16, cdStart, true);
  dv.setUint16(cursor + 20, 0, true); // comment len
  cursor += 22;

  if (cursor !== total) {
    throw new Error(`buildStoreZip: size mismatch ${cursor} vs ${total}`);
  }
  return out;
}

// CRC-32/ISO-HDLC, poly 0xEDB88320 — IEEE 802.3. Table is built once.
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
