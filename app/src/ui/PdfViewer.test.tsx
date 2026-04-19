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
});
