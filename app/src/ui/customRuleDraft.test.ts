import { describe, it, expect } from 'vitest';
import {
  buildDraftRule,
  validateDraftRule,
  regexCompileError,
  EMPTY_DRAFT,
  SEVERITIES,
  CATEGORIES,
  MATCHER_TYPES,
  LEAF_MATCHER_TYPES,
  type CustomRuleDraftForm,
} from './customRuleDraft';

function draft(overrides: Partial<CustomRuleDraftForm>): CustomRuleDraftForm {
  return { ...EMPTY_DRAFT, ...overrides };
}

describe('customRuleDraft constants', () => {
  it('exports the four canonical severities', () => {
    expect(SEVERITIES).toEqual(['high', 'medium', 'low', 'info']);
  });

  it('exports all rule-engine categories', () => {
    expect(CATEGORIES).toContain('general');
    expect(CATEGORIES).toContain('termination');
    expect(CATEGORIES).toContain('liability');
  });

  it('lists the three top-level matcher types', () => {
    expect(MATCHER_TYPES).toEqual(['regex', 'keywordProximity', 'sectionAnchored']);
  });

  it('restricts leaf matcher types to regex + keywordProximity', () => {
    expect(LEAF_MATCHER_TYPES).toEqual(['regex', 'keywordProximity']);
  });

  it('seeds an empty draft with sensible defaults', () => {
    expect(EMPTY_DRAFT.severity).toBe('medium');
    expect(EMPTY_DRAFT.matcherType).toBe('regex');
    expect(EMPTY_DRAFT.regexFlags).toBe('i');
    expect(EMPTY_DRAFT.windowRaw).toBe('60');
  });
});

describe('buildDraftRule — regex matcher', () => {
  it('builds a regex rule with the form pattern + flags', () => {
    const rule = buildDraftRule(
      draft({
        id: 'auto-renew',
        title: 'Auto-renew',
        explanation: 'Detects auto-renewal language.',
        severity: 'high',
        category: 'termination',
        matcherType: 'regex',
        regexPattern: 'auto[- ]?renew',
        regexFlags: 'i',
      }),
    );
    expect(rule.id).toBe('auto-renew');
    expect(rule.severity).toBe('high');
    expect(rule.category).toBe('termination');
    expect(rule.match).toEqual({
      type: 'regex',
      pattern: 'auto[- ]?renew',
      flags: 'i',
    });
    expect(rule.citation).toBeNull();
  });

  it('omits flags when the form leaves them empty', () => {
    const rule = buildDraftRule(
      draft({ matcherType: 'regex', regexPattern: 'foo', regexFlags: '' }),
    );
    expect(rule.match).toEqual({ type: 'regex', pattern: 'foo' });
  });
});

describe('buildDraftRule — keywordProximity matcher', () => {
  it('parses the comma-separated keyword list and trims whitespace', () => {
    const rule = buildDraftRule(
      draft({
        matcherType: 'keywordProximity',
        keywordsRaw: ' jury , waive , rights ',
        windowRaw: '40',
      }),
    );
    expect(rule.match).toEqual({
      type: 'keywordProximity',
      keywords: ['jury', 'waive', 'rights'],
      window: 40,
    });
  });

  it('drops empty entries from the keyword CSV', () => {
    const rule = buildDraftRule(
      draft({
        matcherType: 'keywordProximity',
        keywordsRaw: 'a,,b, ,c',
        windowRaw: '60',
      }),
    );
    expect(rule.match).toMatchObject({ keywords: ['a', 'b', 'c'] });
  });

  it('coerces a non-numeric window to 0', () => {
    const rule = buildDraftRule(
      draft({
        matcherType: 'keywordProximity',
        keywordsRaw: 'a,b',
        windowRaw: 'NaN-ish',
      }),
    );
    expect(rule.match).toMatchObject({ window: 0 });
  });
});

describe('buildDraftRule — sectionAnchored matcher', () => {
  it('nests a regex child under the heading pattern', () => {
    const rule = buildDraftRule(
      draft({
        matcherType: 'sectionAnchored',
        headingPattern: '^indemnification',
        childType: 'regex',
        regexPattern: 'tenant shall',
        regexFlags: 'i',
      }),
    );
    expect(rule.match).toEqual({
      type: 'sectionAnchored',
      headingPattern: '^indemnification',
      child: { type: 'regex', pattern: 'tenant shall', flags: 'i' },
    });
  });

  it('nests a keywordProximity child', () => {
    const rule = buildDraftRule(
      draft({
        matcherType: 'sectionAnchored',
        headingPattern: '^arbitration',
        childType: 'keywordProximity',
        keywordsRaw: 'binding,arbitration',
        windowRaw: '30',
      }),
    );
    expect(rule.match).toMatchObject({
      type: 'sectionAnchored',
      headingPattern: '^arbitration',
      child: {
        type: 'keywordProximity',
        keywords: ['binding', 'arbitration'],
        window: 30,
      },
    });
  });
});

describe('buildDraftRule — optional metadata', () => {
  it('includes jurisdictions only when the CSV is non-empty', () => {
    const withJ = buildDraftRule(
      draft({ matcherType: 'regex', regexPattern: 'x', jurisdictionsRaw: 'CA, NY' }),
    );
    expect(withJ.jurisdictions).toEqual(['CA', 'NY']);
    const without = buildDraftRule(
      draft({ matcherType: 'regex', regexPattern: 'x', jurisdictionsRaw: '' }),
    );
    expect(without.jurisdictions).toBeUndefined();
  });

  it('includes plainEnglish + suggestedEdit only when non-empty', () => {
    const filled = buildDraftRule(
      draft({
        matcherType: 'regex',
        regexPattern: 'x',
        plainEnglish: 'In plain English…',
        suggestedEdit: 'Strike this clause.',
      }),
    );
    expect(filled.plainEnglish).toBe('In plain English…');
    expect(filled.suggestedEdit).toBe('Strike this clause.');

    const empty = buildDraftRule(draft({ matcherType: 'regex', regexPattern: 'x' }));
    expect(empty.plainEnglish).toBeUndefined();
    expect(empty.suggestedEdit).toBeUndefined();
  });
});

describe('validateDraftRule', () => {
  it('returns ok for a fully-formed regex rule', () => {
    const rule = buildDraftRule(
      draft({
        id: 'good-rule',
        title: 'Good',
        explanation: 'Always matches the word foo.',
        matcherType: 'regex',
        regexPattern: 'foo',
        regexFlags: 'i',
      }),
    );
    const result = validateDraftRule(rule);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports schema errors for an empty id', () => {
    const rule = buildDraftRule(
      draft({ matcherType: 'regex', regexPattern: 'foo', regexFlags: 'i' }),
    );
    const result = validateDraftRule(rule);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('strips the rules[0]. prefix from validator messages so UI errors read naturally', () => {
    const rule = buildDraftRule(draft({ matcherType: 'regex', regexPattern: 'foo' }));
    const result = validateDraftRule(rule);
    for (const err of result.errors) {
      expect(err.startsWith('rules[0]')).toBe(false);
    }
  });
});

describe('regexCompileError', () => {
  it('returns null for an empty regex pattern', () => {
    expect(regexCompileError(draft({ matcherType: 'regex', regexPattern: '' }))).toBeNull();
  });

  it('returns null for a valid regex pattern', () => {
    expect(
      regexCompileError(
        draft({ matcherType: 'regex', regexPattern: 'foo[a-z]+', regexFlags: 'i' }),
      ),
    ).toBeNull();
  });

  it('returns the error message for an invalid regex pattern', () => {
    const err = regexCompileError(draft({ matcherType: 'regex', regexPattern: '(unbalanced' }));
    expect(err).toBeTruthy();
    expect(typeof err).toBe('string');
  });

  it('returns null for keywordProximity matcher type (no regex involved)', () => {
    expect(
      regexCompileError(
        draft({ matcherType: 'keywordProximity', keywordsRaw: 'a,b', windowRaw: '50' }),
      ),
    ).toBeNull();
  });

  it('flags an invalid heading pattern under sectionAnchored', () => {
    const err = regexCompileError(
      draft({
        matcherType: 'sectionAnchored',
        headingPattern: '(bad',
        childType: 'regex',
        regexPattern: 'foo',
      }),
    );
    expect(err).toBeTruthy();
  });

  it('flags an invalid child regex under sectionAnchored even if the heading is valid', () => {
    const err = regexCompileError(
      draft({
        matcherType: 'sectionAnchored',
        headingPattern: '^arbitration',
        childType: 'regex',
        regexPattern: '(bad',
      }),
    );
    expect(err).toBeTruthy();
  });

  it('returns null for sectionAnchored with a keywordProximity child', () => {
    expect(
      regexCompileError(
        draft({
          matcherType: 'sectionAnchored',
          headingPattern: '^arbitration',
          childType: 'keywordProximity',
          keywordsRaw: 'a,b',
          windowRaw: '40',
        }),
      ),
    ).toBeNull();
  });
});
