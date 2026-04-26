import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDerivedAppState } from './useDerivedAppState';
import type { Rule } from '../rules/types';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { LeaseDocument } from '../parser/types';

function rule(id: string, partial: Partial<Rule> = {}): Rule {
  return {
    id,
    title: id,
    severity: 'medium',
    category: 'compliance',
    matcher: { kind: 'regex', pattern: 'x' },
    plainEnglish: undefined,
    suggestedEdit: undefined,
    ...partial,
  } as Rule;
}

function offer(ruleId: string, text: string, updatedAt: number): CounterOffer {
  return {
    id: `${ruleId}-${updatedAt}`,
    ruleId,
    name: 'Counter',
    text,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('useDerivedAppState', () => {
  it('builds plainEnglishByRuleId from rules that have plainEnglish set', () => {
    const { result } = renderHook(() =>
      useDerivedAppState({
        activeRules: [
          rule('a', { plainEnglish: 'A in plain words' }),
          rule('b'), // no plainEnglish
          rule('c', { plainEnglish: 'C in plain words' }),
        ],
        counterOffers: [],
        doc: null,
      }),
    );
    expect(result.current.plainEnglishByRuleId).toEqual({
      a: 'A in plain words',
      c: 'C in plain words',
    });
  });

  it('suggestedTextByRuleId starts from rule.suggestedEdit and is overridden by latest counter-offer per rule', () => {
    const { result } = renderHook(() =>
      useDerivedAppState({
        activeRules: [
          rule('a', { suggestedEdit: 'pack edit for a' }),
          rule('b', { suggestedEdit: 'pack edit for b' }),
        ],
        counterOffers: [
          offer('a', 'older user edit', 1000),
          offer('a', 'newer user edit', 2000),
          // b has no counter-offer; falls back to pack
        ],
        doc: null,
      }),
    );
    expect(result.current.suggestedTextByRuleId).toEqual({
      a: 'newer user edit',
      b: 'pack edit for b',
    });
  });

  it('sectionForParagraph returns undefined when doc is null', () => {
    const { result } = renderHook(() =>
      useDerivedAppState({ activeRules: [], counterOffers: [], doc: null }),
    );
    expect(result.current.sectionForParagraph(0)).toBeUndefined();
  });

  it('sectionForParagraph returns the section number/heading for a paragraph in a section', () => {
    const para0 = { text: 'Article body 1', page: 1 };
    const para1 = { text: 'Article body 2', page: 1 };
    const para2 = { text: 'Lone paragraph', page: 1 };
    const doc: LeaseDocument = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [para0, para1, para2],
      sections: [{ number: '1', heading: 'Rent', startPage: 1, paragraphs: [para0, para1] }],
      raw: '',
    };
    const { result } = renderHook(() =>
      useDerivedAppState({ activeRules: [], counterOffers: [], doc }),
    );
    expect(result.current.sectionForParagraph(0)).toBe('1');
    expect(result.current.sectionForParagraph(1)).toBe('1');
    // Paragraph 2 is not in any section.
    expect(result.current.sectionForParagraph(2)).toBeUndefined();
    // Out-of-range index also returns undefined.
    expect(result.current.sectionForParagraph(99)).toBeUndefined();
  });

  it('sectionForParagraph falls back to heading when section.number is missing', () => {
    const para = { text: 'Body', page: 1 };
    const doc: LeaseDocument = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [para],
      sections: [{ heading: 'Preamble', startPage: 1, paragraphs: [para] } as never],
      raw: '',
    };
    const { result } = renderHook(() =>
      useDerivedAppState({ activeRules: [], counterOffers: [], doc }),
    );
    expect(result.current.sectionForParagraph(0)).toBe('Preamble');
  });
});
