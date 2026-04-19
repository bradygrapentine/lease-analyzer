import { describe, it, expect } from 'vitest';
import { exportFindingsHtml } from './exportHtml';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'auto-renewal',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Renews without notice.',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'auto-renew annually',
    span: { start: 0, end: 19 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

function doc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [],
    sections: [],
    raw: '',
  };
}

describe('exportFindingsHtml', () => {
  it('produces a standalone HTML document with title and findings', () => {
    const html = exportFindingsHtml({
      name: 'Lease.pdf',
      doc: doc(),
      findings: [f({})],
    });
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('Lease.pdf');
    expect(html).toContain('Auto-renewal');
    expect(html).toContain('Renews without notice.');
    expect(html).toContain('auto-renew annually');
  });

  it('includes a print stylesheet', () => {
    const html = exportFindingsHtml({ name: 'X', doc: doc(), findings: [] });
    expect(html).toMatch(/@media\s+print/);
  });

  it('escapes HTML-dangerous characters in findings', () => {
    const html = exportFindingsHtml({
      name: '<script>alert(1)</script>',
      doc: doc(),
      findings: [f({ snippet: '<b>pwn</b>', title: 'X & Y' })],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;pwn&lt;/b&gt;');
    expect(html).toContain('X &amp; Y');
  });

  it('renders an empty-state note when no findings', () => {
    const html = exportFindingsHtml({ name: 'X', doc: doc(), findings: [] });
    expect(html).toMatch(/no findings/i);
  });
});
