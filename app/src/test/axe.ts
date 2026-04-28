import { axe } from 'vitest-axe';
import { expect } from 'vitest';
import type { AxeResults, Result, RunOptions } from 'axe-core';

/**
 * Run axe-core against `container` and assert there are zero violations.
 * The failure message includes each violation's id, impact, and the
 * targeted node selectors so a regression points at the offending DOM.
 *
 * jsdom can't host nested browsing contexts, so axe-core's frame
 * messaging throws when a rendered tree contains an `<iframe>`. We
 * disable iframe descent by default — iframe contents must be audited
 * separately in a real browser.
 */
export async function expectAxeClean(container: Element, options?: RunOptions): Promise<void> {
  const merged: RunOptions = { iframes: false, ...(options ?? {}) };
  const results = (await axe(container, merged)) as AxeResults;
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
