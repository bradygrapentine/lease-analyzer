import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingDetailModal } from './FindingDetailModal';
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
    ruleId: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation: 'The lease renews automatically.',
    citation: null,
    page: 1,
    paragraphIndex: 1,
    snippet: 'auto-renew',
    span: { start: 16, end: 26 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

interface SetupOver {
  open?: boolean;
  finding?: Finding | null;
  allFindings?: Finding[];
  suggestedTextByRuleId?: Readonly<Record<string, string>>;
  plainEnglishByRuleId?: Readonly<Record<string, string>>;
}

interface Mocks {
  onSelect: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  onApply: ReturnType<typeof vi.fn>;
  onAddToCounters: ReturnType<typeof vi.fn>;
}

function setup(over: SetupOver = {}): Mocks {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const onApply = vi.fn();
  const onAddToCounters = vi.fn();
  const finding = over.finding === undefined ? f({}) : over.finding;
  const allFindings = over.allFindings ?? [f({}), f({ ruleId: 'jury-waiver', paragraphIndex: 3 })];
  render(
    <I18nProvider>
      <FindingDetailModal
        open={over.open ?? true}
        doc={doc([
          'Lease intro.',
          'The lease shall auto-renew unless cancelled with notice.',
          'Tenant pays rent on the first.',
          'Tenant waives the right to a jury trial in any action.',
        ])}
        finding={finding}
        allFindings={allFindings}
        onSelect={onSelect}
        onClose={onClose}
        suggestedTextByRuleId={over.suggestedTextByRuleId}
        plainEnglishByRuleId={over.plainEnglishByRuleId}
        onApplySuggestion={onApply}
        onAddToCounters={onAddToCounters}
      />
    </I18nProvider>,
  );
  return { onSelect, onClose, onApply, onAddToCounters };
}

describe('FindingDetailModal', () => {
  it('returns null when not open', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns null when finding is null', () => {
    setup({ finding: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the finding title and explanation', () => {
    setup();
    expect(screen.getByRole('heading', { name: /auto-renewal clause/i })).toBeInTheDocument();
    expect(screen.getByText(/lease renews automatically/i)).toBeInTheDocument();
  });

  it('renders the clause text from the resolved paragraph with the snippet highlighted', () => {
    setup();
    const mark = document.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('auto-renew');
  });

  it('skips the inline highlight for hybrid findings (LLM-classified)', () => {
    setup({
      finding: f({
        evidence: { modelId: 'm1', similarity: 0.71 },
        snippet: 'The lease shall',
        span: { start: 0, end: 15 },
      }),
    });
    expect(document.querySelector('mark')).toBeNull();
  });

  it('Esc dismisses (calls onClose)', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the close button dismisses', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Apply to redline fires onApplySuggestion + flips to "Applied" state', async () => {
    const { onApply } = setup({
      suggestedTextByRuleId: { 'auto-renewal': 'Either party may terminate with 30 days notice.' },
    });
    const button = screen.getByRole('button', { name: /apply to redline/i });
    await userEvent.click(button);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /applied to redline/i })).toBeDisabled();
  });

  it('Save as counter-offer fires onAddToCounters', async () => {
    const { onAddToCounters } = setup({
      suggestedTextByRuleId: { 'auto-renewal': 'Either party may terminate.' },
    });
    await userEvent.click(screen.getByRole('button', { name: /save as counter-offer/i }));
    expect(onAddToCounters).toHaveBeenCalled();
  });

  it('Prev/Next nav calls onSelect with the adjacent finding', async () => {
    const second = f({
      ruleId: 'jury-waiver',
      paragraphIndex: 3,
      snippet: 'jury trial',
      span: { start: 27, end: 37 },
    });
    const { onSelect } = setup({ finding: second, allFindings: [f({}), second] });
    await userEvent.click(screen.getByRole('button', { name: /‹ prev finding/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'auto-renewal' }));
  });

  it('disables Prev on the first finding and Next on the last', () => {
    const findings = [f({}), f({ ruleId: 'b', paragraphIndex: 2 })];
    setup({ finding: findings[0], allFindings: findings });
    expect(screen.getByRole('button', { name: /‹ prev finding/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next finding ›/i })).not.toBeDisabled();
  });

  it('does not render Apply / Save as counter-offer when no suggested text is available', () => {
    setup();
    expect(screen.queryByRole('button', { name: /apply to redline/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save as counter-offer/i })).toBeNull();
  });
});
