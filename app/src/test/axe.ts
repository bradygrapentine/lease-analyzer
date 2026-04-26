import { axe } from 'vitest-axe';
import { expect } from 'vitest';
import type { AxeResults, Result } from 'axe-core';

/**
 * Run axe-core against `container` and assert there are zero violations.
 * The failure message includes each violation's id, impact, and the
 * targeted node selectors so a regression points at the offending DOM.
 */
export async function expectAxeClean(container: Element): Promise<void> {
  const results = (await axe(container)) as AxeResults;
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return '';
  return violations
    .map((v) => {
      const targets = v.nodes.map((n) => n.target.join(', ')).join(' | ');
      return `${v.impact ?? 'unknown'} :: ${v.id} — ${v.help}\n  at ${targets}`;
    })
    .join('\n');
}
