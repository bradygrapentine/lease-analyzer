import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PdfViewer } from './PdfViewer';
import type { LineSpan, Paragraph } from './../parser/types';
import type { Finding } from './../rules/types';

describe('PdfViewer', () => {
  it('renders a page container per page', () => {
    render(<PdfViewer bytes={null} pageCount={3} selectedPage={null} />);
    expect(document.getElementById('pdf-page-1')).toBeInTheDocument();
    expect(document.getElementById('pdf-page-2')).toBeInTheDocument();
    expect(document.getElementById('pdf-page-3')).toBeInTheDocument();
  });

  it('scrolls to selectedPage when it changes', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const { rerender } = render(<PdfViewer bytes={null} pageCount={2} selectedPage={null} />);
    rerender(<PdfViewer bytes={null} pageCount={2} selectedPage={2} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('shows empty state when pageCount is 0', () => {
    render(<PdfViewer bytes={null} pageCount={0} selectedPage={null} />);
    expect(screen.getByText(/no document loaded/i)).toBeInTheDocument();
  });

  it('renders a highlight overlay when a bbox is supplied for a page', () => {
    const pages = [{ pageNumber: 1, width: 612, height: 792, items: [] }];
    render(
      <PdfViewer
        bytes={null}
        pageCount={1}
        selectedPage={null}
        pages={pages}
        highlight={{ page: 1, xLeft: 72, xRight: 200, yTop: 720, yBottom: 700 }}
      />,
    );
    const overlay = document.querySelector('.pdf-highlight') as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.style.left).toBe('72px');
    // top = pageHeight(792) - yTop(720) = 72
    expect(overlay?.style.top).toBe('72px');
    expect(overlay?.style.width).toBe('128px');
    expect(overlay?.style.height).toBe('20px');
  });

  it('clips a highlight overlay that extends past the page viewport', () => {
    const pages = [{ pageNumber: 1, width: 612, height: 792, items: [] }];
    render(
      <PdfViewer
        bytes={null}
        pageCount={1}
        selectedPage={null}
        pages={pages}
        // Right edge (700) and top (-50 → top 842) overflow the page.
        highlight={{ page: 1, xLeft: 500, xRight: 700, yTop: 842, yBottom: 700 }}
      />,
    );
    const overlay = document.querySelector('.pdf-highlight') as HTMLElement | null;
    expect(overlay).not.toBeNull();
    // left is unclamped (still inside the page), width is clipped to page.width - left.
    expect(overlay?.style.left).toBe('500px');
    expect(overlay?.style.width).toBe('112px'); // 612 - 500
    // rawTop = 792 - 842 = -50 → clamped to 0; height shrinks accordingly.
    expect(overlay?.style.top).toBe('0px');
    expect(parseFloat(overlay?.style.height ?? '0')).toBeLessThanOrEqual(792);
  });

  it('uses behavior=auto for scrollIntoView when prefers-reduced-motion is set', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { rerender } = render(<PdfViewer bytes={null} pageCount={2} selectedPage={null} />);
    rerender(<PdfViewer bytes={null} pageCount={2} selectedPage={2} />);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    matchMediaSpy.mockRestore();
  });

  it('renders one [data-span-highlight] per overlapping line when paragraph has lines', () => {
    const pages = [{ pageNumber: 1, width: 612, height: 792, items: [] }];
    const lines: LineSpan[] = [
      { start: 0, end: 10, bbox: { page: 1, xLeft: 72, xRight: 200, yTop: 720, yBottom: 710 } },
      { start: 10, end: 20, bbox: { page: 1, xLeft: 72, xRight: 200, yTop: 710, yBottom: 700 } },
      { start: 20, end: 30, bbox: { page: 1, xLeft: 72, xRight: 200, yTop: 700, yBottom: 690 } },
    ];
    const paragraph: Paragraph = {
      text: 'a'.repeat(30),
      page: 1,
      bbox: { page: 1, xLeft: 72, xRight: 200, yTop: 720, yBottom: 690 },
      lines,
    };
    const finding: Finding = {
      ruleId: 'r',
      severity: 'high',
      category: 'fees',
      title: 't',
      explanation: 'e',
      citation: null,
      page: 1,
      paragraphIndex: 0,
      snippet: 's',
      span: { start: 5, end: 25 },
      confidence: 1,
      negated: false,
      rulePackVersion: '1.0.0',
    };
    render(
      <PdfViewer
        bytes={null}
        pageCount={1}
        selectedPage={null}
        pages={pages}
        selectedParagraph={paragraph}
        selectedFinding={finding}
      />,
    );
    const overlays = document.querySelectorAll('[data-span-highlight]');
    // span [5,25) overlaps all three lines (0..10, 10..20, 20..30)
    expect(overlays).toHaveLength(3);
  });

  it('falls back to a single highlight rect for a paragraph without lines', () => {
    const pages = [{ pageNumber: 1, width: 612, height: 792, items: [] }];
    const paragraph: Paragraph = {
      text: 'whole paragraph',
      page: 1,
      bbox: { page: 1, xLeft: 72, xRight: 200, yTop: 720, yBottom: 700 },
    };
    const finding: Finding = {
      ruleId: 'r',
      severity: 'high',
      category: 'fees',
      title: 't',
      explanation: 'e',
      citation: null,
      page: 1,
      paragraphIndex: 0,
      snippet: 's',
      span: { start: 0, end: 5 },
      confidence: 1,
      negated: false,
      rulePackVersion: '1.0.0',
    };
    render(
      <PdfViewer
        bytes={null}
        pageCount={1}
        selectedPage={null}
        pages={pages}
        selectedParagraph={paragraph}
        selectedFinding={finding}
      />,
    );
    const overlays = document.querySelectorAll('.pdf-highlight');
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toHaveAttribute('data-span-highlight');
  });

  it('does not render a highlight for a page that does not match', () => {
    const pages = [
      { pageNumber: 1, width: 612, height: 792, items: [] },
      { pageNumber: 2, width: 612, height: 792, items: [] },
    ];
    render(
      <PdfViewer
        bytes={null}
        pageCount={2}
        selectedPage={null}
        pages={pages}
        highlight={{ page: 2, xLeft: 72, xRight: 200, yTop: 720, yBottom: 700 }}
      />,
    );
    const overlays = document.querySelectorAll('.pdf-highlight');
    expect(overlays).toHaveLength(1);
    expect(overlays[0]?.closest('.pdf-page')?.id).toBe('pdf-page-2');
  });
});
