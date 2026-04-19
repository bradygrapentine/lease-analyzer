import { describe, it, expect } from 'vitest';
import { buildReplayBundle } from './replayBundle';
import type { Finding } from '../rules/types';

function finding(ruleId: string): Finding {
  return {
    ruleId,
    severity: 'medium',
    category: 'general',
    title: `Rule ${ruleId}`,
    explanation: 'Test finding.',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
  };
}

const SAMPLE = {
  leaseName: 'Acme Lease.pdf',
  pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
  packJson: '{"id":"leaseguard.default","version":"1.0.0","rules":[]}',
  expectedFindings: [finding('late-fee'), finding('arbitration')],
  rulePackVersion: '1.0.0',
};

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

describe('buildReplayBundle', () => {
  it('produces a STORE-only ZIP with exactly the five expected entries', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    // LFH signature at byte 0.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    const entries = extractStoreZip(bytes);
    expect(new Set(entries.keys())).toEqual(
      new Set(['lease.pdf', 'pack.lgpack.json', 'expected.json', 'replay.mjs', 'README.md']),
    );
  });

  it('roundtrips lease.pdf byte-for-byte', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    const entries = extractStoreZip(bytes);
    expect(entries.get('lease.pdf')).toEqual(SAMPLE.pdfBytes);
  });

  it('embeds expected.json with schema id and rulePackVersion', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    const entries = extractStoreZip(bytes);
    const expected = JSON.parse(new TextDecoder().decode(entries.get('expected.json')!));
    expect(expected.schema).toBe('leaseguard.findings.v1');
    expect(expected.rulePackVersion).toBe('1.0.0');
    expect(expected.findings).toHaveLength(2);
    expect(expected.findings[0].ruleId).toBe('late-fee');
  });

  it('embeds the pack JSON verbatim', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    const entries = extractStoreZip(bytes);
    const packStr = new TextDecoder().decode(entries.get('pack.lgpack.json')!);
    expect(packStr).toBe(SAMPLE.packJson);
  });

  it('includes a Node replay script that loads the three data files', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    const entries = extractStoreZip(bytes);
    const script = new TextDecoder().decode(entries.get('replay.mjs')!);
    expect(script).toContain('lease.pdf');
    expect(script).toContain('pack.lgpack.json');
    expect(script).toContain('expected.json');
    expect(script).toContain('node:fs/promises');
  });

  it('produces a slugged filename ending in .replay.zip', () => {
    const { filename } = buildReplayBundle(SAMPLE);
    expect(filename).toBe('acme-lease.replay.zip');
  });

  it('falls back to "lease" when the name slug would be empty', () => {
    const { filename } = buildReplayBundle({ ...SAMPLE, leaseName: '!!!' });
    expect(filename).toBe('lease.replay.zip');
  });

  it('is deterministic: two calls with identical input produce identical bytes', () => {
    const a = buildReplayBundle(SAMPLE).bytes;
    const b = buildReplayBundle(SAMPLE).bytes;
    expect(a).toEqual(b);
  });

  it('sorts JSON object keys deterministically regardless of input key order', () => {
    const shuffled: Finding = {
      // Same values as finding('x') but declared in different key order.
      rulePackVersion: '1.0.0',
      negated: false,
      confidence: 0.9,
      span: { end: 7, start: 0 },
      snippet: 'snippet',
      paragraphIndex: 0,
      page: 1,
      citation: null,
      explanation: 'Test finding.',
      title: 'Rule x',
      category: 'general',
      severity: 'medium',
      ruleId: 'x',
    };
    const a = buildReplayBundle({ ...SAMPLE, expectedFindings: [finding('x')] }).bytes;
    const b = buildReplayBundle({ ...SAMPLE, expectedFindings: [shuffled] }).bytes;
    expect(a).toEqual(b);
  });

  it('handles empty findings without blowing up', () => {
    const { bytes } = buildReplayBundle({ ...SAMPLE, expectedFindings: [] });
    const entries = extractStoreZip(bytes);
    const expected = JSON.parse(new TextDecoder().decode(entries.get('expected.json')!));
    expect(expected.findings).toEqual([]);
  });

  it('README.md references the findings schema id', () => {
    const { bytes } = buildReplayBundle(SAMPLE);
    const entries = extractStoreZip(bytes);
    const readme = new TextDecoder().decode(entries.get('README.md')!);
    expect(readme).toContain('leaseguard.findings.v1');
    expect(readme).toContain('Acme Lease.pdf');
  });
});
