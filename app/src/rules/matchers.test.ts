import { describe, it, expect } from 'vitest';
import { runRegex, runKeywordProximity } from './matchers';
import type { Paragraph } from '../parser/types';
import { at } from '../test/assert';

function paras(...texts: string[]): Paragraph[] {
  return texts.map((text, i) => ({ text, page: i + 1 }));
}

describe('runRegex', () => {
  it('returns a match with span indices and snippet', () => {
    const hits = runRegex(
      { type: 'regex', pattern: 'auto[- ]?renew(al)?', flags: 'i' },
      paras('This lease shall auto-renew annually.'),
    );
    expect(hits).toHaveLength(1);
    const hit = at(hits, 0);
    expect(hit.paragraphIndex).toBe(0);
    expect(hit.snippet.toLowerCase()).toContain('auto-renew');
    expect(hit.span.start).toBeGreaterThanOrEqual(0);
    expect(hit.span.end).toBeGreaterThan(hit.span.start);
  });

  it('returns multiple hits across paragraphs', () => {
    const hits = runRegex(
      { type: 'regex', pattern: 'fee', flags: 'i' },
      paras('A late fee applies.', 'No fee for early termination.'),
    );
    expect(hits).toHaveLength(2);
    expect(at(hits, 0).paragraphIndex).toBe(0);
    expect(at(hits, 1).paragraphIndex).toBe(1);
  });

  it('returns empty when no match', () => {
    const hits = runRegex(
      { type: 'regex', pattern: 'arbitration', flags: 'i' },
      paras('Nothing relevant here.'),
    );
    expect(hits).toEqual([]);
  });

  it('returns exactly one hit per paragraph even if pattern would match twice', () => {
    const hits = runRegex(
      { type: 'regex', pattern: 'rent', flags: 'i' },
      paras('Rent is due. Rent is money.'),
    );
    expect(hits).toHaveLength(1);
  });
});

describe('runKeywordProximity', () => {
  it('matches when all keywords are within the window', () => {
    const hits = runKeywordProximity(
      { type: 'keywordProximity', keywords: ['attorney', 'fees'], window: 40 },
      paras('Prevailing party may recover attorney fees and costs.'),
    );
    expect(hits).toHaveLength(1);
    expect(at(hits, 0).snippet.toLowerCase()).toContain('attorney');
  });

  it('does not match when keywords are too far apart', () => {
    const hits = runKeywordProximity(
      { type: 'keywordProximity', keywords: ['attorney', 'fees'], window: 20 },
      paras(
        'The attorney may inspect any premises described herein upon reasonable notice and may assess fees.',
      ),
    );
    expect(hits).toEqual([]);
  });

  it('is case-insensitive', () => {
    const hits = runKeywordProximity(
      { type: 'keywordProximity', keywords: ['JURY', 'waive'], window: 30 },
      paras('Tenant shall waive any right to a jury trial.'),
    );
    expect(hits).toHaveLength(1);
  });

  it('returns empty if any keyword is missing', () => {
    const hits = runKeywordProximity(
      { type: 'keywordProximity', keywords: ['indemnify', 'landlord'], window: 50 },
      paras('The tenant shall indemnify all parties.'),
    );
    expect(hits).toEqual([]);
  });
});
