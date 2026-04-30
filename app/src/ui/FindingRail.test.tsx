import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingRail } from './FindingRail';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'r1',
    severity: 'high',
    category: 'termination',
    title: 'X',
    explanation: '',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start: 0, end: 1 },
    confidence: 1,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

function setup(props: Partial<Parameters<typeof FindingRail>[0]> = {}): {
  onSelectFinding: ReturnType<typeof vi.fn>;
} {
  const onSelectFinding = vi.fn();
  render(
    <I18nProvider>
      <FindingRail
        paragraphCount={5}
        findings={[]}
        selected={null}
        onSelectFinding={onSelectFinding}
        {...props}
      />
    </I18nProvider>,
  );
  return { onSelectFinding };
}

describe('FindingRail', () => {
  it('renders one cell per paragraph; cells without a finding are non-interactive', () => {
    setup({ paragraphCount: 5, findings: [] });
    // No buttons when no findings; only the empty divs.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders a button for each paragraph that has a finding', () => {
    setup({
      paragraphCount: 4,
      findings: [
        f({ ruleId: 'a', paragraphIndex: 1, severity: 'high' }),
        f({ ruleId: 'b', paragraphIndex: 3, severity: 'medium' }),
      ],
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/high finding at paragraph 2/i),
    );
  });

  it('clicking a cell selects the corresponding finding', async () => {
    const finding = f({ ruleId: 'a', paragraphIndex: 1, severity: 'high' });
    const { onSelectFinding } = setup({
      paragraphCount: 4,
      findings: [finding],
    });
    await userEvent.click(screen.getByRole('button'));
    expect(onSelectFinding).toHaveBeenCalledWith(finding);
  });

  it('keeps the highest-severity finding when two land on the same paragraph', () => {
    setup({
      paragraphCount: 2,
      findings: [
        f({ ruleId: 'low', paragraphIndex: 0, severity: 'low' }),
        f({ ruleId: 'high', paragraphIndex: 0, severity: 'high' }),
      ],
    });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/high/i));
  });
});
