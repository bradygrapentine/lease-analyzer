import { describe, it, expect } from 'vitest';
import { reconstructParagraphs } from './paragraphs';
import type { PageText, TextItem } from './types';
import { at } from '../test/assert';

function item(text: string, y: number, x = 72, fontSize = 12): TextItem {
  return { text, x, y, width: text.length * 6, height: fontSize, fontSize };
}

function page(items: TextItem[], pageNumber = 1): PageText {
  return { pageNumber, width: 612, height: 792, items };
}

describe('reconstructParagraphs', () => {
  it('joins items on the same line with spaces', () => {
    const pages = [page([item('The lease', 700), item('begins today.', 700, 150)])];
    const paras = reconstructParagraphs(pages);
    expect(paras).toHaveLength(1);
    expect(at(paras, 0).text).toBe('The lease begins today.');
    expect(at(paras, 0).page).toBe(1);
  });

  it('merges adjacent lines into one paragraph', () => {
    const pages = [page([item('First sentence.', 700), item('Second sentence.', 685)])];
    const paras = reconstructParagraphs(pages);
    expect(paras).toHaveLength(1);
    expect(at(paras, 0).text).toBe('First sentence. Second sentence.');
  });

  it('splits paragraphs on a blank-line gap', () => {
    const pages = [
      page([
        item('First paragraph here.', 700),
        item('Second paragraph here.', 640),
      ]),
    ];
    const paras = reconstructParagraphs(pages);
    expect(paras).toHaveLength(2);
    expect(at(paras, 0).text).toBe('First paragraph here.');
    expect(at(paras, 1).text).toBe('Second paragraph here.');
  });

  it('repairs hyphenated line breaks', () => {
    const pages = [page([item('exam-', 700), item('ple word', 685)])];
    const paras = reconstructParagraphs(pages);
    expect(at(paras, 0).text).toBe('example word');
  });

  it('computes a bounding box that encloses all source items in a merged paragraph', () => {
    const pages = [page([item('First line of body', 700), item('second line here', 685)])];
    const paras = reconstructParagraphs(pages);
    expect(paras).toHaveLength(1);
    const bbox = at(paras, 0).bbox;
    expect(bbox).toBeDefined();
    expect(bbox!.page).toBe(1);
    expect(bbox!.xLeft).toBeLessThanOrEqual(72);
    expect(bbox!.xRight).toBeGreaterThan(72);
    expect(bbox!.yTop).toBeGreaterThanOrEqual(700);
    expect(bbox!.yBottom).toBeLessThanOrEqual(685);
  });

  it('attaches per-line spans whose char ranges sum to paragraph length', () => {
    const pages = [page([item('First line of body', 700), item('second line here', 685)])];
    const paras = reconstructParagraphs(pages);
    expect(paras).toHaveLength(1);
    const p = at(paras, 0);
    expect(p.lines).toBeDefined();
    expect(p.lines!.length).toBe(2);
    // First line covers [0, "First line of body".length)
    expect(p.lines![0]!.start).toBe(0);
    expect(p.lines![0]!.end).toBe('First line of body'.length);
    // Last line ends exactly at paragraph text length
    expect(p.lines![p.lines!.length - 1]!.end).toBe(p.text.length);
    // Each line's bbox is on the same page
    for (const line of p.lines!) {
      expect(line.bbox.page).toBe(p.page);
    }
  });

  it('attaches a single line span for an unmerged paragraph', () => {
    const pages = [page([item('Lonely paragraph.', 700)])];
    const paras = reconstructParagraphs(pages);
    const p = at(paras, 0);
    expect(p.lines).toBeDefined();
    expect(p.lines!.length).toBe(1);
    expect(p.lines![0]!.start).toBe(0);
    expect(p.lines![0]!.end).toBe(p.text.length);
  });

  it('preserves correct line offsets across hyphen-repaired joins', () => {
    const pages = [page([item('exam-', 700), item('ple word', 685)])];
    const paras = reconstructParagraphs(pages);
    const p = at(paras, 0);
    expect(p.text).toBe('example word');
    expect(p.lines).toBeDefined();
    expect(p.lines!.length).toBe(2);
    // First line "exam-" → after repair, prior text becomes "exam" (len 4),
    // so the second line starts at offset 4 with no separator.
    expect(p.lines![0]!.start).toBe(0);
    // Hyphen-repair drops the trailing '-' so first line's end shrinks to "exam".length.
    expect(p.lines![0]!.end).toBe(4);
    expect(p.lines![1]!.start).toBe(4);
    expect(p.lines![1]!.end).toBe(p.text.length);
  });

  it('strips repeating page-header lines', () => {
    const makePage = (n: number): PageText =>
      page(
        [
          item('Acme Lease Agreement', 770, 72, 9),
          item(`Body text on page ${n}.`, 700),
        ],
        n,
      );
    const paras = reconstructParagraphs([makePage(1), makePage(2), makePage(3)]);
    const texts = paras.map((p) => p.text);
    expect(texts).not.toContain('Acme Lease Agreement');
    expect(texts).toContain('Body text on page 1.');
    expect(texts).toContain('Body text on page 3.');
  });
});
