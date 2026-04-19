import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackDiffPanel } from './PackDiffPanel';
import type { PackDiff } from '../rules/packDiff';
import type { Rule } from '../rules/types';

function rule(overrides: Partial<Rule> & { id: string }): Rule {
  return {
    id: overrides.id,
    severity: overrides.severity ?? 'medium',
    category: overrides.category ?? 'fees',
    title: overrides.title ?? `Rule ${overrides.id}`,
    explanation: overrides.explanation ?? 'exp',
    citation: overrides.citation ?? null,
    match: overrides.match ?? { type: 'regex', pattern: 'x', flags: 'i' },
    ...(overrides.jurisdictions ? { jurisdictions: overrides.jurisdictions } : {}),
  };
}

describe('PackDiffPanel', () => {
  it('renders "no changes" when the diff is empty', () => {
    const diff: PackDiff = { added: [], removed: [], changed: [] };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByText(/no changes\./i)).toBeInTheDocument();
  });

  it('renders added rule titles with severity and category', () => {
    const diff: PackDiff = {
      added: [rule({ id: 'a1', title: 'New rule', severity: 'high', category: 'liability' })],
      removed: [],
      changed: [],
    };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByText(/Added \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/New rule/)).toBeInTheDocument();
    expect(screen.getByText(/a1 · high · liability/)).toBeInTheDocument();
  });

  it('renders removed rule titles', () => {
    const diff: PackDiff = {
      added: [],
      removed: [rule({ id: 'r1', title: 'Gone rule' })],
      changed: [],
    };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByText(/Removed \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gone rule/)).toBeInTheDocument();
  });

  it('renders changed rules with a per-field diff', () => {
    const before = rule({ id: 'c1', title: 'Old title', severity: 'low' });
    const after = rule({ id: 'c1', title: 'New title', severity: 'high' });
    const diff: PackDiff = {
      added: [],
      removed: [],
      changed: [
        { ruleId: 'c1', before, after, fields: ['title', 'severity'] },
      ],
    };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByText(/Changed \(1\)/)).toBeInTheDocument();
    // The "after" title is the primary header for the changed entry.
    expect(
      screen.getByRole('article', { name: /changed rule c1/i }),
    ).toBeInTheDocument();
    // Before/after pair visible for each changed field.
    expect(screen.getByLabelText(/before title/i)).toHaveTextContent('Old title');
    expect(screen.getByLabelText(/after title/i)).toHaveTextContent('New title');
    expect(screen.getByLabelText(/before severity/i)).toHaveTextContent('low');
    expect(screen.getByLabelText(/after severity/i)).toHaveTextContent('high');
  });

  it('renders "no rules added/removed/changed" subsection messages', () => {
    const diff: PackDiff = { added: [], removed: [], changed: [] };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByText(/no rules added/i)).toBeInTheDocument();
    expect(screen.getByText(/no rules removed/i)).toBeInTheDocument();
    expect(screen.getByText(/no rules changed/i)).toBeInTheDocument();
  });

  it('sections collapse when their toggle button is pressed', async () => {
    const diff: PackDiff = {
      added: [rule({ id: 'a1' })],
      removed: [],
      changed: [],
    };
    render(<PackDiffPanel diff={diff} />);
    const toggle = screen.getByRole('button', { name: /toggle added section/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Content is visible before collapse.
    expect(screen.getByText(/Rule a1/)).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Rule body hides when the section is collapsed.
    expect(screen.queryByText(/Rule a1/)).not.toBeInTheDocument();
  });

  it('formats a null citation as (none) in the per-field diff', () => {
    const before = rule({ id: 'c1', citation: 'Cal. Civ. Code § 1950.5' });
    const after = rule({ id: 'c1', citation: null });
    const diff: PackDiff = {
      added: [],
      removed: [],
      changed: [{ ruleId: 'c1', before, after, fields: ['citation'] }],
    };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByLabelText(/after citation/i)).toHaveTextContent('(none)');
  });

  it('summarises a match change by matcher type rather than dumping the body', () => {
    const before = rule({
      id: 'c1',
      match: { type: 'regex', pattern: 'a', flags: 'i' },
    });
    const after = rule({
      id: 'c1',
      match: { type: 'keywordProximity', keywords: ['foo', 'bar'], window: 30 },
    });
    const diff: PackDiff = {
      added: [],
      removed: [],
      changed: [{ ruleId: 'c1', before, after, fields: ['match'] }],
    };
    render(<PackDiffPanel diff={diff} />);
    expect(screen.getByLabelText(/before match/i)).toHaveTextContent('regex');
    expect(screen.getByLabelText(/after match/i)).toHaveTextContent('keywordProximity');
  });
});
