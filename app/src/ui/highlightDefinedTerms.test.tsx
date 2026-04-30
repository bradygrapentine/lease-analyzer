import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { highlightDefinedTerms } from './highlightDefinedTerms';
import type { DefinitionEntry } from '../facts/types';
import type { GlossaryEntry } from '../glossary/loadGlossary';

function entry(term: string, definition: string): DefinitionEntry {
  return { term, definition, page: 1, paragraphIndex: 0 };
}

function glossEntry(term: string, definition: string): GlossaryEntry {
  return { term, definition };
}

function renderNodes(nodes: ReactNode): HTMLElement {
  const { container } = render(<div>{nodes}</div>);
  return container.firstChild as HTMLElement;
}

// Wave 51-E — `<dfn title>` replaced by `<GlossaryTerm>`. Term wrappers
// are now `<button>`s that open a `role="tooltip"` popover on hover or
// focus. Tests query buttons + popovers instead of <dfn>.
function termButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
}

describe('highlightDefinedTerms', () => {
  it('returns the original text unchanged when no entries match', () => {
    const nodes = highlightDefinedTerms('Hello world.', [entry('widget', 'a thing')]);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('Hello world.');
    expect(termButtons(root)).toHaveLength(0);
  });

  it('is a no-op on an empty entries array', () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', []);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('The Premises are leased.');
    expect(termButtons(root)).toHaveLength(0);
  });

  it('wraps a matched term in a button + popover trigger', async () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', [
      entry('Premises', 'the building and land.'),
    ]);
    renderNodes(nodes);
    const trigger = screen.getByRole('button', { name: 'Premises' });
    expect(trigger).toBeInTheDocument();
    // Hover opens the popover.
    await userEvent.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/the building and land/i);
  });

  it('matches case-insensitively but preserves the original casing', () => {
    const nodes = highlightDefinedTerms('the premises include the building.', [
      entry('Premises', 'the building and land.'),
    ]);
    renderNodes(nodes);
    expect(screen.getByRole('button', { name: 'premises' })).toBeInTheDocument();
  });

  it('matches at string boundaries (start and end)', () => {
    const start = highlightDefinedTerms('Premises are important.', [
      entry('Premises', 'the building.'),
    ]);
    renderNodes(start);
    expect(screen.getAllByRole('button', { name: 'Premises' })).toHaveLength(1);
  });

  it('matches whole words only (no substring wrapping)', () => {
    const nodes = highlightDefinedTerms(
      'Subpremises and multipremises mentions should not match.',
      [entry('Premises', 'the building.')],
    );
    const root = renderNodes(nodes);
    expect(termButtons(root)).toHaveLength(0);
  });

  it('handles multiple distinct terms in the same string', () => {
    const nodes = highlightDefinedTerms('The Tenant shall occupy the Premises.', [
      entry('Tenant', 'lessee'),
      entry('Premises', 'the building'),
    ]);
    const root = renderNodes(nodes);
    const labels = termButtons(root).map((b) => b.textContent);
    expect(labels).toEqual(['Tenant', 'Premises']);
  });

  it('prefers the longest term when two entries overlap', () => {
    const nodes = highlightDefinedTerms('The Base Rent is due monthly.', [
      entry('Base Rent', 'the initial monthly rent'),
      entry('Rent', 'money paid for occupancy'),
    ]);
    const root = renderNodes(nodes);
    const buttons = termButtons(root);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Base Rent');
  });

  it('wraps multiple occurrences of the same term', () => {
    const nodes = highlightDefinedTerms('Tenant pays rent. Tenant also pays utilities.', [
      entry('Tenant', 'the lessee'),
    ]);
    const root = renderNodes(nodes);
    expect(termButtons(root)).toHaveLength(2);
  });

  it('deduplicates entries by case-insensitive term', () => {
    const nodes = highlightDefinedTerms('The tenant moves in.', [
      entry('tenant', 'one definition'),
      entry('TENANT', 'another definition'),
    ]);
    const root = renderNodes(nodes);
    expect(termButtons(root)).toHaveLength(1);
  });

  it('returns plain text for text with no defined terms but non-empty entries', () => {
    const nodes = highlightDefinedTerms('Nothing here matches.', [
      entry('Premises', 'the building'),
    ]);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('Nothing here matches.');
    expect(termButtons(root)).toHaveLength(0);
  });

  it('ignores entries with an empty term string', () => {
    const nodes = highlightDefinedTerms('The Premises are fine.', [
      entry('', 'ignored'),
      entry('Premises', 'the building'),
    ]);
    const root = renderNodes(nodes);
    const buttons = termButtons(root);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Premises');
  });

  it('focusing a term opens the popover (keyboard path)', async () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', [
      entry('Premises', 'the building and land.'),
    ]);
    renderNodes(nodes);
    const trigger = screen.getByRole('button', { name: 'Premises' });
    await userEvent.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/the building and land/i);
  });

  it('Esc closes the popover and returns focus to the trigger', async () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', [
      entry('Premises', 'the building.'),
    ]);
    renderNodes(nodes);
    const trigger = screen.getByRole('button', { name: 'Premises' });
    await userEvent.hover(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    // Move keyboard focus onto the trigger so Esc's focus-restore lands
    // somewhere observable.
    trigger.focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps a glossary-only term and surfaces its definition in the popover', async () => {
    const nodes = highlightDefinedTerms(
      'Tenant must indemnify the landlord.',
      [],
      [glossEntry('indemnify', 'agree to cover losses')],
    );
    renderNodes(nodes);
    const trigger = screen.getByRole('button', { name: 'indemnify' });
    await userEvent.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/agree to cover losses/i);
  });

  it('wraps lease-defined and glossary terms together in one pass', () => {
    const nodes = highlightDefinedTerms(
      'The Tenant must indemnify the Premises owner.',
      [entry('Premises', 'the building')],
      [glossEntry('indemnify', 'agree to cover losses')],
    );
    const root = renderNodes(nodes);
    const labels = termButtons(root).map((b) => b.textContent);
    expect(labels).toContain('indemnify');
    expect(labels).toContain('Premises');
  });

  it('lease-defined terms win over glossary entries on duplicate term', async () => {
    const nodes = highlightDefinedTerms(
      'The Premises must be returned.',
      [entry('Premises', 'lease-specific definition')],
      [glossEntry('Premises', 'generic glossary definition')],
    );
    renderNodes(nodes);
    const trigger = screen.getByRole('button', { name: 'Premises' });
    await userEvent.hover(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/lease-specific definition/i);
  });

  it('returns the original text when only an empty glossary is supplied', () => {
    const nodes = highlightDefinedTerms('Hello world.', [], []);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('Hello world.');
    expect(termButtons(root)).toHaveLength(0);
  });

  it('ignores glossary entries with an empty term string', () => {
    const nodes = highlightDefinedTerms(
      'Tenant must indemnify the landlord.',
      [],
      [glossEntry('', 'ignored'), glossEntry('indemnify', 'agree to cover losses')],
    );
    const root = renderNodes(nodes);
    const buttons = termButtons(root);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('indemnify');
  });
});
