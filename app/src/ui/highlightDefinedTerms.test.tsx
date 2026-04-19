import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { highlightDefinedTerms } from './highlightDefinedTerms';
import type { DefinitionEntry } from '../facts/types';

function entry(term: string, definition: string): DefinitionEntry {
  return { term, definition, page: 1, paragraphIndex: 0 };
}

function renderNodes(nodes: ReactNode): HTMLElement {
  const { container } = render(<div>{nodes}</div>);
  return container.firstChild as HTMLElement;
}

describe('highlightDefinedTerms', () => {
  it('returns the original text unchanged when no entries match', () => {
    const nodes = highlightDefinedTerms('Hello world.', [entry('widget', 'a thing')]);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('Hello world.');
    expect(root.querySelector('dfn')).toBeNull();
  });

  it('is a no-op on an empty entries array', () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', []);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('The Premises are leased.');
    expect(root.querySelector('dfn')).toBeNull();
  });

  it('wraps a matched term in a dfn with a title tooltip', () => {
    const nodes = highlightDefinedTerms('The Premises are leased.', [
      entry('Premises', 'the building and land.'),
    ]);
    const root = renderNodes(nodes);
    const dfn = root.querySelector('dfn');
    expect(dfn).not.toBeNull();
    expect(dfn?.textContent).toBe('Premises');
    expect(dfn?.getAttribute('title')).toBe('the building and land.');
  });

  it('matches case-insensitively but preserves the original casing', () => {
    const nodes = highlightDefinedTerms('the premises include the building.', [
      entry('Premises', 'the building and land.'),
    ]);
    const root = renderNodes(nodes);
    const dfn = root.querySelector('dfn');
    expect(dfn).not.toBeNull();
    expect(dfn?.textContent).toBe('premises');
  });

  it('matches at string boundaries (start and end)', () => {
    const start = highlightDefinedTerms('Premises are important.', [
      entry('Premises', 'the building.'),
    ]);
    const rootStart = renderNodes(start);
    expect(rootStart.querySelector('dfn')?.textContent).toBe('Premises');

    const end = highlightDefinedTerms('The lease covers the Premises', [
      entry('Premises', 'the building.'),
    ]);
    const rootEnd = renderNodes(end);
    expect(rootEnd.querySelector('dfn')?.textContent).toBe('Premises');
  });

  it('matches whole words only (no substring wrapping)', () => {
    const nodes = highlightDefinedTerms(
      'Subpremises and multipremises mentions should not match.',
      [entry('Premises', 'the building.')],
    );
    const root = renderNodes(nodes);
    expect(root.querySelector('dfn')).toBeNull();
  });

  it('handles multiple distinct terms in the same string', () => {
    const nodes = highlightDefinedTerms(
      'The Tenant shall occupy the Premises.',
      [entry('Tenant', 'lessee'), entry('Premises', 'the building')],
    );
    const root = renderNodes(nodes);
    const dfns = root.querySelectorAll('dfn');
    expect(dfns.length).toBe(2);
    const texts = Array.from(dfns).map((d) => d.textContent);
    expect(texts).toEqual(['Tenant', 'Premises']);
  });

  it('prefers the longest term when two entries overlap', () => {
    const nodes = highlightDefinedTerms('The Base Rent is due monthly.', [
      entry('Base Rent', 'the initial monthly rent'),
      entry('Rent', 'money paid for occupancy'),
    ]);
    const root = renderNodes(nodes);
    const dfns = root.querySelectorAll('dfn');
    // The longer term (Base Rent) should win over the shorter overlap.
    expect(dfns.length).toBe(1);
    expect(dfns[0]?.textContent).toBe('Base Rent');
  });

  it('wraps multiple occurrences of the same term', () => {
    const nodes = highlightDefinedTerms(
      'Tenant pays rent. Tenant also pays utilities.',
      [entry('Tenant', 'the lessee')],
    );
    const root = renderNodes(nodes);
    const dfns = root.querySelectorAll('dfn');
    expect(dfns.length).toBe(2);
  });

  it('deduplicates entries by case-insensitive term', () => {
    const nodes = highlightDefinedTerms('The tenant moves in.', [
      entry('tenant', 'one definition'),
      entry('TENANT', 'another definition'),
    ]);
    const root = renderNodes(nodes);
    const dfns = root.querySelectorAll('dfn');
    expect(dfns.length).toBe(1);
  });

  it('returns plain text for text with no defined terms but non-empty entries', () => {
    const nodes = highlightDefinedTerms('Nothing here matches.', [
      entry('Premises', 'the building'),
    ]);
    const root = renderNodes(nodes);
    expect(root.textContent).toBe('Nothing here matches.');
    expect(root.querySelector('dfn')).toBeNull();
  });

  it('ignores entries with an empty term string', () => {
    const nodes = highlightDefinedTerms('The Premises are fine.', [
      entry('', 'ignored'),
      entry('Premises', 'the building'),
    ]);
    const root = renderNodes(nodes);
    const dfns = root.querySelectorAll('dfn');
    expect(dfns.length).toBe(1);
    expect(dfns[0]?.textContent).toBe('Premises');
  });
});
