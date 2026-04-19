import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PdfViewer } from './PdfViewer';

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
