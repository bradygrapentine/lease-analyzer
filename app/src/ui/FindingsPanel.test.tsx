import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';
import type { DefinitionEntry } from '../facts/types';

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

describe('FindingsPanel', () => {
  it('groups findings under High / Medium / Low headings', () => {
    const findings = [
      f({ ruleId: 'a', severity: 'high', title: 'Arbitration' }),
      f({ ruleId: 'b', severity: 'medium', title: 'Late fee' }),
      f({ ruleId: 'c', severity: 'low', title: 'Pet policy' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: /high/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /low/i })).toBeInTheDocument();
    expect(screen.getByText('Arbitration')).toBeInTheDocument();
  });

  it('renders an empty state when no findings', () => {
    render(<FindingsPanel findings={[]} onSelect={() => {}} />);
    expect(screen.getByText(/no findings/i)).toBeInTheDocument();
  });

  it('calls onSelect with the finding when a row is clicked', async () => {
    const onSelect = vi.fn();
    const finding = f({ ruleId: 'picked', title: 'Picked one' });
    render(<FindingsPanel findings={[finding]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /picked one/i }));
    expect(onSelect).toHaveBeenCalledWith(finding);
  });

  it('shows a "negated" badge on negated findings', () => {
    render(
      <FindingsPanel
        findings={[f({ ruleId: 'n', title: 'Maybe', negated: true })]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/not applicable/i)).toBeInTheDocument();
  });

  // Wave 24-B: hybrid findings (those with `evidence` from the Phase 18
  // classifier pass) render a small badge whose aria-label conveys the
  // model's similarity score for screen readers. Deterministic findings
  // render no badge.
  it('renders a hybrid badge with similarity percentage on findings carrying evidence', () => {
    render(
      <FindingsPanel
        findings={[
          f({
            ruleId: 'h',
            title: 'Hybrid hit',
            confidence: 0.5,
            evidence: { modelId: 'Xenova/test-model', similarity: 0.83 },
          }),
        ]}
        onSelect={() => {}}
      />,
    );
    const badge = screen.getByLabelText(/identified by on-device classifier \(similarity 83%\)/i);
    expect(badge).toBeInTheDocument();
  });

  it('renders no hybrid badge on deterministic findings (no evidence)', () => {
    render(
      <FindingsPanel
        findings={[f({ ruleId: 'd', title: 'Deterministic hit' })]}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/identified by on-device classifier/i)).not.toBeInTheDocument();
  });

  it('filters findings by search query across title and explanation', async () => {
    const findings = [
      f({ ruleId: 'a', title: 'Arbitration clause', explanation: 'Disputes go to arbitrator.' }),
      f({ ruleId: 'b', title: 'Rent escalation', explanation: 'Rent rises annually.' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    const search = screen.getByRole('searchbox', { name: /search findings/i });
    await userEvent.type(search, 'arbitr');
    expect(screen.getByText('Arbitration clause')).toBeInTheDocument();
    expect(screen.queryByText('Rent escalation')).not.toBeInTheDocument();
  });

  it('hides findings when their severity chip is toggled off', async () => {
    const findings = [
      f({ ruleId: 'a', severity: 'high', title: 'Arbitration' }),
      f({ ruleId: 'b', severity: 'medium', title: 'Late fee' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    const highChip = screen.getByRole('button', { name: /severity high/i });
    await userEvent.click(highChip);
    expect(screen.queryByText('Arbitration')).not.toBeInTheDocument();
    expect(screen.getByText('Late fee')).toBeInTheDocument();
  });

  it('hides findings when their category chip is toggled off', async () => {
    const findings = [
      f({ ruleId: 'a', category: 'dispute', title: 'Arbitration' }),
      f({ ruleId: 'b', category: 'finance', title: 'Rent escalation' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    const disputeChip = screen.getByRole('button', { name: /category dispute/i });
    await userEvent.click(disputeChip);
    expect(screen.queryByText('Arbitration')).not.toBeInTheDocument();
    expect(screen.getByText('Rent escalation')).toBeInTheDocument();
  });

  it('ArrowDown moves focus to the next finding button', async () => {
    const findings = [
      f({ ruleId: 'a', severity: 'high', title: 'First' }),
      f({ ruleId: 'b', severity: 'high', title: 'Second' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    const first = screen.getByRole('button', { name: /first/i });
    first.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /second/i }));
  });

  it('Enter on a focused finding triggers onSelect', async () => {
    const onSelect = vi.fn();
    const finding = f({ ruleId: 'enter', title: 'Enter me' });
    render(<FindingsPanel findings={[finding]} onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: /enter me/i });
    btn.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(finding);
  });

  it('collapses a severity group when its heading is clicked', async () => {
    const findings = [
      f({ ruleId: 'a', severity: 'high', title: 'Arbitration' }),
      f({ ruleId: 'b', severity: 'medium', title: 'Late fee' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    expect(screen.getByText('Arbitration')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /toggle high/i });
    await userEvent.click(toggle);
    expect(screen.queryByText('Arbitration')).not.toBeInTheDocument();
    expect(screen.getByText('Late fee')).toBeInTheDocument();
  });

  // Phase 14 — plainEnglish disclosure.

  it('renders a "What this means" disclosure when plainEnglish is provided for a rule', async () => {
    const finding = f({ ruleId: 'pe-rule', title: 'PE title' });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        plainEnglishByRuleId={{ 'pe-rule': 'In practice, this means X.' }}
      />,
    );
    const toggle = screen.getByRole('button', {
      name: /what this means for pe title/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('In practice, this means X.')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText('In practice, this means X.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('omits the "What this means" disclosure when plainEnglish is absent', () => {
    const finding = f({ ruleId: 'no-pe', title: 'No PE' });
    render(<FindingsPanel findings={[finding]} onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: /what this means/i })).not.toBeInTheDocument();
  });

  it('omits the "What this means" disclosure when the map has no entry for this rule', () => {
    const finding = f({ ruleId: 'missing', title: 'Missing PE' });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        plainEnglishByRuleId={{ 'other-rule': 'not this one' }}
      />,
    );
    expect(screen.queryByRole('button', { name: /what this means/i })).not.toBeInTheDocument();
  });

  // Phase 14 — hover glossary on snippets.

  it('wraps defined terms in the snippet with a dfn when definitions are provided', () => {
    const finding = f({
      ruleId: 'def',
      title: 'Glossary hit',
      snippet: 'The Premises shall be delivered on time.',
    });
    const definitions: DefinitionEntry[] = [
      { term: 'Premises', definition: 'the leased building.', page: 1, paragraphIndex: 0 },
    ];
    const { container } = render(
      <FindingsPanel findings={[finding]} onSelect={() => {}} definitions={definitions} />,
    );
    const dfn = container.querySelector('dfn');
    expect(dfn).not.toBeNull();
    expect(dfn?.textContent).toBe('Premises');
    expect(dfn?.getAttribute('title')).toBe('the leased building.');
  });

  it('renders plain snippet text when no definitions prop is provided', () => {
    const finding = f({
      ruleId: 'no-def',
      title: 'No glossary',
      snippet: 'The Premises shall be delivered on time.',
    });
    const { container } = render(<FindingsPanel findings={[finding]} onSelect={() => {}} />);
    expect(container.querySelector('dfn')).toBeNull();
  });

  it('renders plain snippet text when definitions is an empty array', () => {
    const finding = f({
      ruleId: 'empty-def',
      title: 'Empty glossary',
      snippet: 'The Premises shall be delivered on time.',
    });
    const { container } = render(
      <FindingsPanel findings={[finding]} onSelect={() => {}} definitions={[]} />,
    );
    expect(container.querySelector('dfn')).toBeNull();
  });

  // Phase 9 — "Apply suggestion" additive prop.

  it('renders an "Apply suggestion" button when callback + suggestedText exist for the rule', () => {
    const finding = f({ ruleId: 'apply', title: 'Apply me', paragraphIndex: 4 });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        suggestedTextByRuleId={{ apply: 'Suggested replacement.' }}
        onApplySuggestion={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /apply suggestion for apply me/i }),
    ).toBeInTheDocument();
  });

  it('omits "Apply suggestion" when onApplySuggestion is not provided', () => {
    const finding = f({ ruleId: 'nobtn', title: 'No btn' });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        suggestedTextByRuleId={{ nobtn: 'Suggested.' }}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply suggestion/i })).not.toBeInTheDocument();
  });

  it('omits "Apply suggestion" when the rule id has no suggested text', () => {
    const finding = f({ ruleId: 'solo', title: 'Solo' });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        suggestedTextByRuleId={{}}
        onApplySuggestion={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply suggestion/i })).not.toBeInTheDocument();
  });

  it('"Apply suggestion" invokes the callback with finding, paragraphIndex, and suggested text', async () => {
    const onApplySuggestion = vi.fn();
    const finding = f({
      ruleId: 'apply',
      title: 'Apply me',
      paragraphIndex: 4,
    });
    render(
      <FindingsPanel
        findings={[finding]}
        onSelect={() => {}}
        suggestedTextByRuleId={{ apply: 'Suggested replacement.' }}
        onApplySuggestion={onApplySuggestion}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /apply suggestion for apply me/i }));
    expect(onApplySuggestion).toHaveBeenCalledWith(finding, 4, 'Suggested replacement.');
  });

  // Phase 13 — virtualization.

  describe('virtualization', () => {
    type Cb = (entries: IntersectionObserverEntry[]) => void;
    interface StubObserverHandle {
      cb: Cb;
      targets: Element[];
      fire(target: Element, isIntersecting: boolean): void;
    }
    const instances: StubObserverHandle[] = [];

    function installStubObserver(): void {
      instances.length = 0;
      class StubObserver {
        cb: Cb;
        targets: Element[] = [];
        constructor(cb: Cb) {
          this.cb = cb;
          const handle: StubObserverHandle = {
            cb,
            targets: this.targets,
            fire: (target, isIntersecting) => {
              cb([
                {
                  target,
                  isIntersecting,
                } as unknown as IntersectionObserverEntry,
              ]);
            },
          };
          instances.push(handle);
        }
        observe(t: Element): void {
          this.targets.push(t);
        }
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
        StubObserver as unknown as typeof IntersectionObserver;
    }

    function uninstallStubObserver(): void {
      delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
      instances.length = 0;
    }

    it('renders off-viewport items as placeholders while visible ones render full', async () => {
      installStubObserver();
      try {
        const findings = [
          f({ ruleId: 'a', severity: 'high', title: 'First finding' }),
          f({ ruleId: 'b', severity: 'high', title: 'Second finding' }),
          f({ ruleId: 'c', severity: 'high', title: 'Third finding' }),
        ];
        const { container } = render(<FindingsPanel findings={findings} onSelect={() => {}} />);

        // Before any intersection event, all three are "off viewport" in
        // the observer-present branch — they should appear as placeholders
        // (aria-hidden divs) and the finding titles should NOT be in the DOM.
        expect(container.querySelectorAll('[data-finding-placeholder]')).toHaveLength(3);
        expect(screen.queryByText('First finding')).not.toBeInTheDocument();
        expect(screen.queryByText('Second finding')).not.toBeInTheDocument();

        // Mark only the middle item as intersecting — it should mount full.
        // Each row has its own observer instance (one per useInViewport).
        const middle = instances[1];
        expect(middle).toBeDefined();
        const middleTarget = middle?.targets[0];
        expect(middleTarget).toBeDefined();
        await act(async () => {
          middle?.fire(middleTarget as Element, true);
        });

        expect(screen.getByText('Second finding')).toBeInTheDocument();
        expect(screen.queryByText('First finding')).not.toBeInTheDocument();
        expect(screen.queryByText('Third finding')).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-finding-placeholder]')).toHaveLength(2);
      } finally {
        uninstallStubObserver();
      }
    });

    it('keeps initial DOM under a tight budget for a 300-finding synthetic scenario', () => {
      installStubObserver();
      try {
        const findings = Array.from({ length: 300 }, (_, i) =>
          f({
            ruleId: `r-${i}`,
            severity: 'medium',
            title: `Finding number ${i}`,
            paragraphIndex: i,
            span: { start: i, end: i + 5 },
          }),
        );
        const { container } = render(<FindingsPanel findings={findings} onSelect={() => {}} />);
        // With no intersections reported yet, every row is a placeholder.
        const fullButtons = container.querySelectorAll('button.finding-btn');
        expect(fullButtons.length).toBeLessThan(100);
        // And the total <li> count equals the finding count — the list
        // is still in the DOM, just swapped to placeholders.
        const liCount = container.querySelectorAll('li[data-finding-key]').length;
        expect(liCount).toBe(300);
      } finally {
        uninstallStubObserver();
      }
    });
  });
});
