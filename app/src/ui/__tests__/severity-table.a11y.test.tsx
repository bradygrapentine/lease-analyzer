// Wave 28 Part F — axe-core sweep across SeverityOverridesPanel.
//
// Per plan §5 Part F.3 / F.6: re-verifies that Round-2's badge fix
// (dark fg + tinted bg + low-alpha border) holds against axe color
// contrast, and that the table semantics (scope=col headers, label/select
// pairing, action button labels) survive.
import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { SeverityOverridesPanel } from '../SeverityOverridesPanel';
import { expectAxeClean } from '../../test/axe';

const RULES = [
  { id: 'r-info', title: 'Info rule', severity: 'info' as const },
  { id: 'r-warn', title: 'Warn rule', severity: 'warn' as const },
  { id: 'r-error', title: 'Error rule', severity: 'error' as const },
];

describe('SeverityOverridesPanel a11y (Wave 28 Part F)', () => {
  it('empty branch — zero axe violations', async () => {
    const { container } = render(
      <SeverityOverridesPanel rules={[]} overrides={{}} onChange={() => {}} />,
    );
    await expectAxeClean(container);
  });

  it('populated table with all severity badges — zero axe violations', async () => {
    const { container } = render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ 'r-warn': 'error' }}
        onChange={() => {}}
      />,
    );
    await expectAxeClean(container);
  });

  it('with scope toggle column — zero axe violations', async () => {
    const { container } = render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ 'r-warn': 'error' }}
        onChange={() => {}}
        portfolioOverrides={{ 'r-error': 'info' }}
        onScopeChange={() => {}}
      />,
    );
    await expectAxeClean(container);
  });
});
