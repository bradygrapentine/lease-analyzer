import { describe, it, expect } from 'vitest';
import {
  RULE_PACK_SCHEMA_VERSION,
  validatePackFile,
  type RulePackFile,
} from './packSchema';

function validPack(overrides: Partial<RulePackFile> = {}): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id: 'example-pack',
    name: 'Example Pack',
    version: '1.0.0',
    description: 'A minimal example',
    rules: [
      {
        id: 'example-regex',
        severity: 'medium',
        category: 'fees',
        title: 'Example regex rule',
        explanation: 'This fires on "example".',
        citation: null,
        match: {
          type: 'regex',
          pattern: '\\bexample\\b',
          flags: 'i',
        },
      },
    ],
    ...overrides,
  };
}

describe('validatePackFile', () => {
  it('accepts a fully valid pack', () => {
    const result = validatePackFile(validPack());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.id).toBe('example-pack');
      expect(result.pack.rules).toHaveLength(1);
    }
  });

  it('rejects non-object inputs', () => {
    const cases: unknown[] = [null, undefined, 'string', 42, []];
    for (const c of cases) {
      const result = validatePackFile(c);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects wrong schema tag', () => {
    const bad = { ...validPack(), schema: 'not-a-leaseguard-pack' };
    const result = validatePackFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/schema/);
    }
  });

  it('rejects missing required top-level fields', () => {
    const bad = {
      schema: RULE_PACK_SCHEMA_VERSION,
      // no id/name/version/description/rules
    };
    const result = validatePackFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/id/);
      expect(result.errors.join(' ')).toMatch(/name/);
      expect(result.errors.join(' ')).toMatch(/version/);
      expect(result.errors.join(' ')).toMatch(/rules/);
    }
  });

  it('rejects rules that are not an array', () => {
    const bad = { ...validPack(), rules: 'nope' };
    const result = validatePackFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/rules/);
  });

  it('rejects unknown severity', () => {
    const pack = validPack();
    pack.rules[0]!.severity = 'catastrophic' as never;
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/severity/);
  });

  it('rejects unknown category', () => {
    const pack = validPack();
    pack.rules[0]!.category = 'made-up' as never;
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/category/);
  });

  it('rejects unknown matcher type', () => {
    const pack = validPack();
    pack.rules[0]!.match = { type: 'elvis', pattern: 'x' } as never;
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/matcher/i);
  });

  it('rejects regex matcher without pattern', () => {
    const pack = validPack();
    pack.rules[0]!.match = { type: 'regex' } as never;
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/pattern/);
  });

  it('rejects regex matcher with invalid pattern', () => {
    const pack = validPack();
    pack.rules[0]!.match = { type: 'regex', pattern: '(' };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/regex/i);
  });

  it('rejects keywordProximity without keywords', () => {
    const pack = validPack();
    pack.rules[0]!.match = { type: 'keywordProximity', keywords: [], window: 40 };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/keywords/);
  });

  it('rejects keywordProximity with non-positive window', () => {
    const pack = validPack();
    pack.rules[0]!.match = { type: 'keywordProximity', keywords: ['a', 'b'], window: 0 };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/window/);
  });

  it('accepts sectionAnchored with a valid child matcher', () => {
    const pack = validPack();
    pack.rules[0]!.match = {
      type: 'sectionAnchored',
      headingPattern: '^Disputes',
      child: { type: 'regex', pattern: 'arbitration', flags: 'i' },
    };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(true);
  });

  it('rejects sectionAnchored without a headingPattern', () => {
    const pack = validPack();
    pack.rules[0]!.match = {
      type: 'sectionAnchored',
      child: { type: 'regex', pattern: 'x' },
    } as never;
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/headingPattern/);
  });

  it('rejects sectionAnchored with invalid child', () => {
    const pack = validPack();
    pack.rules[0]!.match = {
      type: 'sectionAnchored',
      headingPattern: '^Termination',
      child: { type: 'elvis' } as never,
    };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/child/);
  });

  it('rejects a rule without an id', () => {
    const pack = validPack();
    pack.rules[0] = { ...pack.rules[0]!, id: '' };
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/id/);
  });

  it('rejects duplicate rule ids within a pack', () => {
    const pack = validPack();
    pack.rules = [pack.rules[0]!, { ...pack.rules[0]! }];
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('accepts null citation or string citation', () => {
    const pack = validPack();
    pack.rules[0]!.citation = 'https://example.com';
    expect(validatePackFile(pack).ok).toBe(true);

    pack.rules[0]!.citation = null;
    expect(validatePackFile(pack).ok).toBe(true);
  });

  it('rejects non-string title/explanation', () => {
    const bad = validPack();
    bad.rules[0]!.title = 42 as never;
    const result = validatePackFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/title/);
  });

  it('exports the schema version constant', () => {
    expect(RULE_PACK_SCHEMA_VERSION).toBe('leaseguard.rulepack.v1');
  });

  it('accepts a rule with a jurisdictions array of non-empty strings', () => {
    const pack = validPack();
    pack.rules[0]!.jurisdictions = ['US-CA', 'US-NY'];
    expect(validatePackFile(pack).ok).toBe(true);
  });

  it('accepts a rule with jurisdictions omitted (applies everywhere)', () => {
    const pack = validPack();
    delete pack.rules[0]!.jurisdictions;
    expect(validatePackFile(pack).ok).toBe(true);
  });

  it('accepts a rule with an empty jurisdictions array', () => {
    const pack = validPack();
    pack.rules[0]!.jurisdictions = [];
    expect(validatePackFile(pack).ok).toBe(true);
  });

  it('rejects jurisdictions that is not an array', () => {
    const pack = validPack();
    (pack.rules[0] as unknown as Record<string, unknown>)['jurisdictions'] =
      'US-CA';
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/jurisdictions/);
  });

  it('rejects jurisdictions with an empty-string entry', () => {
    const pack = validPack();
    pack.rules[0]!.jurisdictions = ['US-CA', ''];
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/jurisdictions/);
  });

  it('rejects jurisdictions containing a non-string entry', () => {
    const pack = validPack();
    (pack.rules[0] as unknown as Record<string, unknown>)['jurisdictions'] = [
      'US-CA',
      42,
    ];
    const result = validatePackFile(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/jurisdictions/);
  });
});
