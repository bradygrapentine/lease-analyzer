import { describe, it, expect } from 'vitest';
import { exportFindingsJson } from './exportReport';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
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
    ...over,
  };
}

function doc(): LeaseDocument {
  return {
    pages: [
      { pageNumber: 1, width: 612, height: 792, items: [] },
      { pageNumber: 2, width: 612, height: 792, items: [] },
    ],
    paragraphs: [
      { text: 'a', page: 1 },
      { text: 'b', page: 2 },
    ],
    sections: [],
    raw: 'a\n\nb',
  };
}

describe('exportFindingsJson', () => {
  it('emits a valid JSON string with a schema header', () => {
    const json = exportFindingsJson({ name: 'Lease.pdf', doc: doc(), findings: [f({})] });
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('leaseguard.findings.v1');
    expect(parsed.lease.name).toBe('Lease.pdf');
    expect(parsed.lease.pageCount).toBe(2);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.rulePackVersion).toBe('1.0.0');
  });

  it('is pretty-printed and stable for same input', () => {
    const a = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const b = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    expect(a).toBe(b);
    expect(a.includes('\n')).toBe(true);
  });

  it('excludes raw document body from the export', () => {
    const json = exportFindingsJson({ name: 'X', doc: doc(), findings: [] });
    expect(json).not.toContain('"raw"');
  });

  it('handles empty findings', () => {
    const parsed = JSON.parse(
      exportFindingsJson({ name: 'X', doc: doc(), findings: [] }),
    );
    expect(parsed.findings).toEqual([]);
    expect(parsed.rulePackVersion).toBe(null);
  });
});
