import { describe, it, expect } from 'vitest';
import { buildStoreZip } from './storeZip';

function u8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}
function readU32LE(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0;
}

const SIG_LFH = 0x04034b50;
const SIG_CDH = 0x02014b50;
const SIG_EOCD = 0x06054b50;

describe('buildStoreZip — byte layout', () => {
  it('produces a zero-entry archive that is exactly 22 bytes (EOCD only)', () => {
    const zip = buildStoreZip([]);
    expect(zip.length).toBe(22);
    expect(readU32LE(zip, 0)).toBe(SIG_EOCD);
    expect(readU16LE(zip, 8)).toBe(0); // entries on disk
    expect(readU16LE(zip, 10)).toBe(0); // total entries
    expect(readU32LE(zip, 12)).toBe(0); // CD size
    expect(readU32LE(zip, 16)).toBe(0); // CD offset
  });

  it('starts with the PK\\x03\\x04 local file header for non-empty archives', () => {
    const zip = buildStoreZip([{ name: 'a.txt', data: u8('hi') }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(readU32LE(zip, 0)).toBe(SIG_LFH);
  });

  it('ends with the PK\\x05\\x06 end-of-central-directory signature', () => {
    const zip = buildStoreZip([{ name: 'a.txt', data: u8('hi') }]);
    expect(readU32LE(zip, zip.length - 22)).toBe(SIG_EOCD);
  });

  it('writes STORE method (0) and uses uncompressed-equals-compressed sizes', () => {
    const data = u8('hello world');
    const zip = buildStoreZip([{ name: 'a.txt', data }]);
    // method at offset 8 in LFH
    expect(readU16LE(zip, 8)).toBe(0);
    // comp size at offset 18, uncomp size at offset 22 — both equal data length
    expect(readU32LE(zip, 18)).toBe(data.length);
    expect(readU32LE(zip, 22)).toBe(data.length);
  });

  it('encodes the EOCD with correct entry count, CD size, and CD offset', () => {
    const files = [
      { name: 'a.txt', data: u8('hi') },
      { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3, 4, 5]) },
    ];
    const zip = buildStoreZip(files);
    const eocd = zip.length - 22;
    expect(readU32LE(zip, eocd)).toBe(SIG_EOCD);
    expect(readU16LE(zip, eocd + 8)).toBe(2);
    expect(readU16LE(zip, eocd + 10)).toBe(2);

    const cdOffset = readU32LE(zip, eocd + 16);
    const cdSize = readU32LE(zip, eocd + 12);
    // CD must start with a CDH signature, end where EOCD begins.
    expect(readU32LE(zip, cdOffset)).toBe(SIG_CDH);
    expect(cdOffset + cdSize).toBe(eocd);
  });

  it('writes a CDH per entry, each pointing back at its LFH offset', () => {
    const files = [
      { name: 'a.txt', data: u8('hi') },
      { name: 'b.txt', data: u8('there') },
    ];
    const zip = buildStoreZip(files);
    const eocd = zip.length - 22;
    let cur = readU32LE(zip, eocd + 16);
    const lfhOffsets: number[] = [];
    for (let i = 0; i < 2; i++) {
      expect(readU32LE(zip, cur)).toBe(SIG_CDH);
      lfhOffsets.push(readU32LE(zip, cur + 42));
      const nameLen = readU16LE(zip, cur + 28);
      cur += 46 + nameLen;
    }
    // First LFH is always at offset 0; second LFH is past first entry payload.
    expect(lfhOffsets[0]).toBe(0);
    expect(readU32LE(zip, lfhOffsets[0]!)).toBe(SIG_LFH);
    expect(readU32LE(zip, lfhOffsets[1]!)).toBe(SIG_LFH);
    expect(lfhOffsets[1]).toBeGreaterThan(lfhOffsets[0]!);
  });

  it('encodes UTF-8 multi-byte filenames correctly', () => {
    const name = 'résumé.txt'; // 11 bytes UTF-8 (é = 2 bytes ×2)
    const expectedNameBytes = new TextEncoder().encode(name);
    const zip = buildStoreZip([{ name, data: u8('x') }]);
    // LFH name length at offset 26
    expect(readU16LE(zip, 26)).toBe(expectedNameBytes.length);
    const inZip = zip.slice(30, 30 + expectedNameBytes.length);
    expect(Array.from(inZip)).toEqual(Array.from(expectedNameBytes));
  });
});

describe('buildStoreZip — CRC-32', () => {
  // Known CRC-32/ISO-HDLC vectors.
  it('computes the canonical CRC32 of "123456789" (0xCBF43926)', () => {
    const zip = buildStoreZip([{ name: 'x', data: u8('123456789') }]);
    expect(readU32LE(zip, 14)).toBe(0xcbf43926);
  });

  it('computes CRC32 of empty input as 0', () => {
    const zip = buildStoreZip([{ name: 'x', data: new Uint8Array(0) }]);
    expect(readU32LE(zip, 14)).toBe(0);
  });

  it('writes the same CRC32 in the LFH and the matching CDH entry', () => {
    const zip = buildStoreZip([{ name: 'x', data: u8('hello') }]);
    const lfhCrc = readU32LE(zip, 14);
    // Find CDH via EOCD pointer.
    const eocd = zip.length - 22;
    const cdOffset = readU32LE(zip, eocd + 16);
    expect(readU32LE(zip, cdOffset)).toBe(SIG_CDH);
    expect(readU32LE(zip, cdOffset + 16)).toBe(lfhCrc);
  });
});

describe('buildStoreZip — size invariants', () => {
  it('total bytes = sum(LFH + name + payload) + sum(CDH + name) + 22', () => {
    const files = [
      { name: 'a', data: u8('xx') },
      { name: 'longer-name.txt', data: new Uint8Array(100) },
      { name: 'c', data: u8('!') },
    ];
    let lfh = 0;
    let cdh = 0;
    for (const f of files) {
      const nameLen = new TextEncoder().encode(f.name).length;
      lfh += 30 + nameLen + f.data.length;
      cdh += 46 + nameLen;
    }
    const expected = lfh + cdh + 22;
    expect(buildStoreZip(files).length).toBe(expected);
  });

  it('preserves payload bytes verbatim (STORE = no transformation)', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const zip = buildStoreZip([{ name: 'a', data }]);
    // Payload begins at 30 (LFH) + 1 (name "a") = 31.
    const payload = zip.slice(31, 31 + 256);
    expect(Array.from(payload)).toEqual(Array.from(data));
  });
});
