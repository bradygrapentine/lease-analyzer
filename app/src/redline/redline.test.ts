import { describe, it, expect } from 'vitest';
import { applyEdits, buildRedlineHtml, computeParagraphDiff, type RedlineEdit } from './redline';
import type { LeaseDocument, Paragraph } from '../parser/types';
import { at } from '../test/assert';

function para(text: string, page = 1): Paragraph {
  return { text, page };
}

function docOf(...texts: string[]): LeaseDocument {
  const paragraphs = texts.map((t) => para(t));
  return {
    pages: [],
    paragraphs,
    sections: [],
    raw: texts.join('\n\n'),
  };
}

function edit(
  paragraphIndex: number,
  before: string,
  after: string,
  over: Partial<RedlineEdit> = {},
): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex,
    before,
    after,
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

describe('applyEdits', () => {
  it('returns the same document when there are no edits', () => {
    const d = docOf('a', 'b');
    expect(applyEdits(d, [])).toBe(d);
  });

  it('replaces paragraph text at matching indices', () => {
    const d = docOf('first', 'second', 'third');
    const result = applyEdits(d, [edit(1, 'second', 'SECOND!')]);
    expect(at(result.paragraphs, 0).text).toBe('first');
    expect(at(result.paragraphs, 1).text).toBe('SECOND!');
    expect(at(result.paragraphs, 2).text).toBe('third');
  });

  it('ignores edits whose paragraphIndex is out of range', () => {
    const d = docOf('only');
    const result = applyEdits(d, [edit(5, 'x', 'y'), edit(-1, 'a', 'b')]);
    expect(at(result.paragraphs, 0).text).toBe('only');
    expect(result).toBe(d);
  });

  it('does not mutate the input document', () => {
    const d = docOf('first', 'second');
    applyEdits(d, [edit(0, 'first', 'FIRST')]);
    expect(at(d.paragraphs, 0).text).toBe('first');
  });

  it('preserves paragraph page/bbox metadata when replacing text', () => {
    const d: LeaseDocument = {
      pages: [],
      paragraphs: [
        { text: 'a', page: 2, bbox: { page: 2, xLeft: 1, xRight: 2, yTop: 3, yBottom: 4 } },
      ],
      sections: [],
      raw: 'a',
    };
    const result = applyEdits(d, [edit(0, 'a', 'A')]);
    expect(at(result.paragraphs, 0).page).toBe(2);
    expect(at(result.paragraphs, 0).bbox).toEqual({
      page: 2,
      xLeft: 1,
      xRight: 2,
      yTop: 3,
      yBottom: 4,
    });
  });
});

describe('computeParagraphDiff', () => {
  it('returns a single unchanged chunk when inputs are identical', () => {
    const chunks = computeParagraphDiff('the quick brown fox', 'the quick brown fox');
    expect(chunks).toEqual([{ kind: 'unchanged', text: 'the quick brown fox' }]);
  });

  it('returns empty array when both inputs are empty', () => {
    expect(computeParagraphDiff('', '')).toEqual([]);
  });

  it('marks all chunks added when before is empty', () => {
    const chunks = computeParagraphDiff('', 'new text');
    expect(chunks).toEqual([{ kind: 'added', text: 'new text' }]);
  });

  it('marks all chunks removed when after is empty', () => {
    const chunks = computeParagraphDiff('old text', '');
    expect(chunks).toEqual([{ kind: 'removed', text: 'old text' }]);
  });

  it('identifies a single-word substitution at end', () => {
    const chunks = computeParagraphDiff('the quick brown fox', 'the quick brown dog');
    // Expect 'the quick brown ' unchanged, 'fox' removed, 'dog' added.
    const kinds = chunks.map((c) => c.kind);
    expect(kinds).toContain('removed');
    expect(kinds).toContain('added');
    const joined = chunks
      .filter((c) => c.kind !== 'removed')
      .map((c) => c.text)
      .join('');
    expect(joined).toBe('the quick brown dog');
  });

  it('identifies insertions in the middle', () => {
    const chunks = computeParagraphDiff('a b d', 'a b c d');
    expect(chunks.some((c) => c.kind === 'added' && c.text.includes('c'))).toBe(true);
  });

  it('merges adjacent same-kind chunks into one', () => {
    // A totally disjoint rewrite with no shared tokens collapses to a
    // single removed chunk followed by a single added chunk.
    const chunks = computeParagraphDiff('alpha', 'bravo');
    const addedCount = chunks.filter((c) => c.kind === 'added').length;
    const removedCount = chunks.filter((c) => c.kind === 'removed').length;
    expect(addedCount).toBe(1);
    expect(removedCount).toBe(1);
  });
});

describe('buildRedlineHtml', () => {
  it('renders a plain doc HTML with no ins/del tags when edits array is empty', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('hello world'),
      edits: [],
    });
    expect(html).toContain('hello world');
    expect(html).not.toContain('<ins>');
    expect(html).not.toContain('<del>');
  });

  it('emits ins/del inside the edited paragraph', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('the quick brown fox'),
      edits: [edit(0, 'the quick brown fox', 'the quick brown dog')],
    });
    expect(html).toContain('<ins>');
    expect(html).toContain('<del>');
    expect(html).toContain('dog');
    expect(html).toContain('fox');
  });

  it('ignores edits whose paragraphIndex does not exist in the doc', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('only paragraph'),
      edits: [edit(99, 'x', 'y')],
    });
    expect(html).not.toContain('<ins>');
    expect(html).not.toContain('<del>');
  });

  it('escapes HTML-special characters in paragraph text and lease name', () => {
    const html = buildRedlineHtml({
      leaseName: '<Lease & Co>',
      doc: docOf('5 < 10 & "quotes"'),
      edits: [],
    });
    expect(html).toContain('&lt;Lease &amp; Co&gt;');
    expect(html).toContain('&lt; 10 &amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('includes a @media print stylesheet block', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('p'),
      edits: [],
    });
    expect(html).toContain('@media print');
  });

  it('does not emit ins/del when before === after (trivial edit)', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('same'),
      edits: [edit(0, 'same', 'same')],
    });
    expect(html).not.toContain('<ins>');
    expect(html).not.toContain('<del>');
  });

  it('reports the edit count in the meta line', () => {
    const html = buildRedlineHtml({
      leaseName: 'L',
      doc: docOf('a', 'b'),
      edits: [edit(0, 'a', 'A')],
    });
    expect(html).toMatch(/1 edit\b/);
  });
});
