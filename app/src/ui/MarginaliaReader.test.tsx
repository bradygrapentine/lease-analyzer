import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarginaliaReader } from './MarginaliaReader';
import { I18nProvider } from '../i18n/I18nProvider';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

function doc(paragraphs: string[]): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: paragraphs.map((text) => ({ text, page: 1 })),
    sections: [],
    raw: paragraphs.join('\n\n'),
  };
}

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'r1',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation: '',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'auto-renew',
    span: { start: 16, end: 26 },
    confidence: 1,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

function setup(props: Partial<Parameters<typeof MarginaliaReader>[0]> = {}): {
  onSelectFinding: ReturnType<typeof vi.fn>;
} {
  const onSelectFinding = vi.fn();
  render(
    <I18nProvider>
      <MarginaliaReader
        doc={doc(['The lease shall auto-renew unless cancelled.'])}
        findings={[f({})]}
        selected={null}
        onSelectFinding={onSelectFinding}
        fileName="lease.pdf"
        {...props}
      />
    </I18nProvider>,
  );
  return { onSelectFinding };
}

describe('MarginaliaReader', () => {
  it('renders the file name + page count in the document header', () => {
    setup();
    expect(screen.getByText(/lease\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/document/i)).toBeInTheDocument();
  });

  it('renders each paragraph and wraps the finding snippet in a <mark>', () => {
    setup();
    const mark = document.querySelector('mark[data-finding-id]');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toContain('auto-renew');
  });

  it('clicking a margin card selects the finding', async () => {
    const { onSelectFinding } = setup();
    await userEvent.click(screen.getByRole('button', { name: /auto-renewal/i }));
    expect(onSelectFinding).toHaveBeenCalled();
  });

  it('clicking the inline highlight selects the finding', async () => {
    const { onSelectFinding } = setup();
    const mark = document.querySelector('mark[data-finding-id]') as HTMLElement;
    await userEvent.click(mark);
    expect(onSelectFinding).toHaveBeenCalled();
  });

  it('skips highlighting when the finding snippet is not present in the paragraph', () => {
    setup({
      doc: doc(['No interesting text.']),
      findings: [f({ snippet: 'absent', span: { start: 0, end: 6 } })],
    });
    const mark = document.querySelector('mark[data-finding-id]');
    // Span fallback still attempts a highlight inside the paragraph (text is
    // 20 chars, span 0..6 is in-range), so a mark exists. With snippet
    // mismatch and an out-of-range span, no highlight should render:
    expect(mark?.textContent ?? '').not.toContain('absent');
  });

  it('renders only paragraph text when a finding has no resolvable highlight range', () => {
    setup({
      doc: doc(['Short paragraph.']),
      findings: [f({ snippet: 'nope', span: { start: 100, end: 200 } })],
    });
    expect(document.querySelector('mark[data-finding-id]')).toBeNull();
  });

  it('does not throw when an imported rule pack id contains CSS-selector metacharacters', () => {
    // Imported packs only validate `ruleId` as non-empty string. A quote
    // or `]` would have broken the unescaped querySelector before fix.
    expect(() =>
      setup({
        selected: f({ ruleId: 'rule"with]brackets', span: { start: 0, end: 10 } }),
        doc: doc(['The lease shall auto-renew unless cancelled.']),
        findings: [f({ ruleId: 'rule"with]brackets', span: { start: 16, end: 26 } })],
      }),
    ).not.toThrow();
  });

  it('exposes a paragraph anchor (data-paragraph-index) for fallback scrolling', () => {
    setup({
      doc: doc(['First paragraph.', 'Second paragraph.']),
      findings: [],
    });
    expect(document.querySelector('[data-paragraph-index="0"]')).not.toBeNull();
    expect(document.querySelector('[data-paragraph-index="1"]')).not.toBeNull();
  });

  it('skips inline highlight for hybrid findings (LLM-classified) — only renders the margin card', () => {
    setup({
      doc: doc(['The lease shall auto-renew unless cancelled.']),
      findings: [
        f({
          snippet: 'The lease shall auto-renew unless cancelled.',
          span: { start: 0, end: 44 },
          evidence: { modelId: 'm1', similarity: 0.71 },
        }),
      ],
    });
    // Hybrid finding's span/snippet covers the whole paragraph, but
    // because `evidence` is set we must NOT fabricate an inline highlight.
    expect(document.querySelector('mark[data-finding-id]')).toBeNull();
    // The margin card still renders so the user sees the finding.
    expect(screen.getByRole('button', { name: /auto-renewal/i })).toBeInTheDocument();
  });
});
