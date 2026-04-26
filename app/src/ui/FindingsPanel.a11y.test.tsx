import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { FindingsPanel } from './FindingsPanel';
import { RULE_PACK_V1 } from '../rules/packV1';
import type { Finding } from '../rules/types';
import { expectAxeClean } from '../test/axe';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'rule',
    severity: 'medium',
    category: 'general',
    title: 'Generic title',
    explanation: 'Generic explanation.',
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

describe('FindingsPanel a11y', () => {
  it('empty state has no axe violations', async () => {
    const { container } = render(<FindingsPanel findings={[]} onSelect={() => {}} />);
    await expectAxeClean(container);
  });

  it('single severity has no axe violations', async () => {
    const findings: Finding[] = [
      f({ ruleId: 'a', severity: 'high', title: 'Arbitration' }),
      f({ ruleId: 'b', severity: 'high', title: 'Late fee' }),
    ];
    const { container } = render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    await expectAxeClean(container);
  });

  it('full pack across all severities has no axe violations', async () => {
    const findings: Finding[] = RULE_PACK_V1.map((rule, idx) =>
      f({
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        title: rule.title,
        explanation: rule.explanation,
        page: (idx % 3) + 1,
      }),
    );
    const { container } = render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    await expectAxeClean(container);
  });
});
