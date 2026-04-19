import { describe, it, expect } from 'vitest';
import { matchTemplates } from './matchTemplates';
import type { ClauseTemplate } from './types';
import type { LeaseDocument } from '../parser/types';
import { at } from '../test/assert';

function doc(paragraphs: Array<{ text: string; page: number }>): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: [],
    raw: paragraphs.map((p) => p.text).join('\n'),
  };
}

function tpl(id: string, name: string, text: string): ClauseTemplate {
  return { id, name, text, createdAt: 0, updatedAt: 0 };
}

describe('matchTemplates', () => {
  it('returns a strong match when the template is nearly identical to a paragraph', () => {
    const templates = [
      tpl('a', 'Arbitration', 'Any dispute shall be resolved by binding arbitration.'),
    ];
    const d = doc([
      { text: 'Rent is $2000 per month.', page: 1 },
      { text: 'Any dispute shall be resolved by binding arbitration.', page: 3 },
    ]);
    const [match] = matchTemplates(templates, d);
    expect(match?.templateId).toBe('a');
    expect(match?.bestScore).toBeGreaterThan(0.9);
    expect(match?.matchedParagraphIndex).toBe(1);
    expect(match?.matchedPage).toBe(3);
    expect(match?.matchedSnippet).toMatch(/binding arbitration/i);
  });

  it('returns a weak match for loosely related paragraphs', () => {
    const templates = [
      tpl('w', 'Jury waiver', 'Tenant and landlord waive the right to a jury trial in any action.'),
    ];
    const d = doc([{ text: 'Tenant has no right to assign this lease.', page: 1 }]);
    const [match] = matchTemplates(templates, d);
    expect(match?.bestScore).toBeGreaterThan(0);
    expect(match?.bestScore).toBeLessThan(0.7);
  });

  it('returns bestScore 0 and null matched fields when document has no paragraphs', () => {
    const templates = [tpl('x', 'Anything', 'This is a template body.')];
    const [match] = matchTemplates(templates, doc([]));
    expect(match?.bestScore).toBe(0);
    expect(match?.matchedParagraphIndex).toBeNull();
    expect(match?.matchedPage).toBeNull();
    expect(match?.matchedSnippet).toBeNull();
  });

  it('returns one match per template, preserving order', () => {
    const templates = [tpl('a', 'A', 'aaa'), tpl('b', 'B', 'bbb'), tpl('c', 'C', 'ccc')];
    const d = doc([{ text: 'aaa', page: 1 }]);
    const out = matchTemplates(templates, d);
    expect(out).toHaveLength(3);
    expect(at(out, 0).templateId).toBe('a');
    expect(at(out, 1).templateId).toBe('b');
    expect(at(out, 2).templateId).toBe('c');
  });

  it('picks the best-matching paragraph when several are similar', () => {
    const templates = [tpl('best', 'Best', 'Rent is $1000 per month.')];
    const d = doc([
      { text: 'Rent is $9999 per year.', page: 1 },
      { text: 'Rent is $1000 per month.', page: 2 },
      { text: 'Totally unrelated text about parking spaces.', page: 3 },
    ]);
    const [match] = matchTemplates(templates, d);
    expect(match?.matchedParagraphIndex).toBe(1);
    expect(match?.matchedPage).toBe(2);
    expect(match?.bestScore).toBe(1);
  });

  it('truncates long matched snippets with an ellipsis', () => {
    const longText = 'x'.repeat(500);
    const templates = [tpl('l', 'Long', longText)];
    const d = doc([{ text: longText, page: 1 }]);
    const [match] = matchTemplates(templates, d);
    expect(match?.matchedSnippet?.endsWith('…')).toBe(true);
    expect(match?.matchedSnippet?.length ?? 0).toBeLessThanOrEqual(241);
  });

  it('returns an empty result when no templates are provided', () => {
    const d = doc([{ text: 'anything', page: 1 }]);
    expect(matchTemplates([], d)).toEqual([]);
  });
});
