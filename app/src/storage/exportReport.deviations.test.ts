import { describe, it, expect } from 'vitest';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
// Wave 8 Part B — round-trip the new `deviations` field on the signed
// export envelope. Fails until the implementer:
//   1. Adds `BaselineDeviation[]` to ExportInput + payload.
//   2. Threads it through exportFindingsJson.
import {
  exportFindingsJson,
  type ExportInput,
} from './exportReport';
import type { BaselineDeviation } from '../rules/packBaseline';

function doc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [{ text: 'a', page: 1 }],
    sections: [],
    raw: 'a',
  };
}

const FINDING: Finding = {
  ruleId: 'auto-renewal',
  severity: 'medium',
  category: 'termination',
  title: 'Auto-renewal',
  explanation: 'Test',
  citation: null,
  page: 1,
  paragraphIndex: 0,
  snippet: 'snippet',
  span: { start: 0, end: 7 },
  confidence: 0.9,
  negated: false,
  rulePackVersion: '1.0.0',
};

describe('exportFindingsJson includes deviations[] (Wave 8 Part B)', () => {
  it('round-trips an empty deviations array as []', () => {
    const input: ExportInput = {
      name: 'Lease.pdf',
      doc: doc(),
      findings: [FINDING],
      deviations: [],
    } as ExportInput;
    const parsed = JSON.parse(exportFindingsJson(input));
    expect(parsed.deviations).toEqual([]);
  });

  it('round-trips a populated deviations array preserving id + fingerprints', () => {
    const dev: BaselineDeviation = {
      id: 'auto-renewal',
      baselineFingerprint: 'a'.repeat(64),
      currentFingerprint: 'b'.repeat(64),
      deviates: true,
    };
    const input: ExportInput = {
      name: 'Lease.pdf',
      doc: doc(),
      findings: [FINDING],
      deviations: [dev],
    } as ExportInput;
    const parsed = JSON.parse(exportFindingsJson(input));
    expect(parsed.deviations).toHaveLength(1);
    expect(parsed.deviations[0]).toMatchObject({
      id: 'auto-renewal',
      baselineFingerprint: 'a'.repeat(64),
      currentFingerprint: 'b'.repeat(64),
      deviates: true,
    });
  });
});
