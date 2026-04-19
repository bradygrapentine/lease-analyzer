import { describe, it, expect } from 'vitest';
import { buildHandoffZip } from './buildHandoffZip';

function u8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('buildHandoffZip', () => {
  const sample = {
    pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), // "%PDF-1.4"
    findingsHtml: '<html><body><h1>Findings</h1></body></html>',
    findingsJson: '{"version":"v1","findings":[]}',
    readme: 'Handoff bundle — see findings.html for the report.',
  };

  it('starts with the PK\\x03\\x04 local file header signature', () => {
    const zip = buildHandoffZip(sample);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('ends with the PK\\x05\\x06 end-of-central-directory signature', () => {
    const zip = buildHandoffZip(sample);
    // EOCD is at least 22 bytes; comment length is 0 here, so it's at the end.
    const n = zip.length;
    expect(zip[n - 22]).toBe(0x50);
    expect(zip[n - 21]).toBe(0x4b);
    expect(zip[n - 20]).toBe(0x05);
    expect(zip[n - 19]).toBe(0x06);
  });

  it('contains all four expected filenames as literal bytes', () => {
    const zip = buildHandoffZip(sample);
    const asStr = new TextDecoder('latin1').decode(zip);
    expect(asStr).toContain('lease.pdf');
    expect(asStr).toContain('findings.html');
    expect(asStr).toContain('findings.json');
    expect(asStr).toContain('README.txt');
  });

  it('encodes each entry with STORE (compression method 0)', () => {
    const zip = buildHandoffZip(sample);
    // First local file header: method at offset 8–10 must be 0.
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(dv.getUint16(8, true)).toBe(0); // method = stored
  });

  it('EOCD records the correct total entry count (4)', () => {
    const zip = buildHandoffZip(sample);
    const n = zip.length;
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // EOCD at n-22. total entries in central dir at offset +10.
    const total = dv.getUint16(n - 22 + 10, true);
    expect(total).toBe(4);
  });

  it('central directory points to a local file header at each recorded offset', () => {
    const zip = buildHandoffZip(sample);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const n = zip.length;
    const cdOffset = dv.getUint32(n - 22 + 16, true);
    const cdSize = dv.getUint32(n - 22 + 12, true);
    // Walk the central directory and spot-check each entry's LFH offset.
    let cursor = cdOffset;
    const end = cdOffset + cdSize;
    let count = 0;
    while (cursor < end) {
      // Central header signature
      expect(dv.getUint32(cursor, true)).toBe(0x02014b50);
      const nameLen = dv.getUint16(cursor + 28, true);
      const extraLen = dv.getUint16(cursor + 30, true);
      const commentLen = dv.getUint16(cursor + 32, true);
      const lfhOffset = dv.getUint32(cursor + 42, true);
      // LFH signature check:
      expect(dv.getUint32(lfhOffset, true)).toBe(0x04034b50);
      cursor += 46 + nameLen + extraLen + commentLen;
      count++;
    }
    expect(count).toBe(4);
  });

  it('records payload sizes that match the raw input bytes (STORE = no compression)', () => {
    const zip = buildHandoffZip(sample);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const expected: Record<string, number> = {
      'lease.pdf': sample.pdfBytes.length,
      'findings.html': u8(sample.findingsHtml).length,
      'findings.json': u8(sample.findingsJson).length,
      'README.txt': u8(sample.readme).length,
    };
    const n = zip.length;
    const cdOffset = dv.getUint32(n - 22 + 16, true);
    const cdSize = dv.getUint32(n - 22 + 12, true);
    let cursor = cdOffset;
    const end = cdOffset + cdSize;
    while (cursor < end) {
      const compSize = dv.getUint32(cursor + 20, true);
      const uncompSize = dv.getUint32(cursor + 24, true);
      const nameLen = dv.getUint16(cursor + 28, true);
      const name = new TextDecoder().decode(zip.subarray(cursor + 46, cursor + 46 + nameLen));
      expect(compSize).toBe(uncompSize); // STORE: no compression
      expect(uncompSize).toBe(expected[name]!);
      cursor += 46 + nameLen + dv.getUint16(cursor + 30, true) + dv.getUint16(cursor + 32, true);
    }
  });

  it('roundtrips each payload byte-for-byte', () => {
    const zip = buildHandoffZip(sample);
    const entries = extractStoreZip(zip);
    expect(entries.get('lease.pdf')).toEqual(sample.pdfBytes);
    expect(new TextDecoder().decode(entries.get('findings.html')!)).toBe(sample.findingsHtml);
    expect(new TextDecoder().decode(entries.get('findings.json')!)).toBe(sample.findingsJson);
    expect(new TextDecoder().decode(entries.get('README.txt')!)).toBe(sample.readme);
  });

  it('handles empty inputs without blowing up', () => {
    const zip = buildHandoffZip({
      pdfBytes: new Uint8Array(0),
      findingsHtml: '',
      findingsJson: '',
      readme: '',
    });
    expect(zip[0]).toBe(0x50);
    const entries = extractStoreZip(zip);
    expect(entries.get('lease.pdf')!.length).toBe(0);
    expect(entries.size).toBe(4);
  });

  it('produces matching CRC-32 values for each entry in LFH and CD', () => {
    const zip = buildHandoffZip(sample);
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const n = zip.length;
    const cdOffset = dv.getUint32(n - 22 + 16, true);
    const cdSize = dv.getUint32(n - 22 + 12, true);
    let cursor = cdOffset;
    while (cursor < cdOffset + cdSize) {
      const cdCrc = dv.getUint32(cursor + 16, true);
      const lfhOffset = dv.getUint32(cursor + 42, true);
      const lfhCrc = dv.getUint32(lfhOffset + 14, true);
      expect(cdCrc).toBe(lfhCrc);
      const nameLen = dv.getUint16(cursor + 28, true);
      cursor += 46 + nameLen + dv.getUint16(cursor + 30, true) + dv.getUint16(cursor + 32, true);
    }
  });
});

/** Minimal STORE-only zip reader for round-trip assertions. */
function extractStoreZip(zip: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out = new Map<string, Uint8Array>();
  let cursor = 0;
  while (cursor < zip.length) {
    const sig = dv.getUint32(cursor, true);
    if (sig !== 0x04034b50) break; // reached central directory
    const method = dv.getUint16(cursor + 8, true);
    if (method !== 0) throw new Error('expected STORE');
    const compSize = dv.getUint32(cursor + 18, true);
    const nameLen = dv.getUint16(cursor + 26, true);
    const extraLen = dv.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = new TextDecoder().decode(zip.subarray(nameStart, nameStart + nameLen));
    out.set(name, zip.slice(dataStart, dataStart + compSize));
    cursor = dataStart + compSize;
  }
  return out;
}
