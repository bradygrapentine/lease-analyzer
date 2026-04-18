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
