import { useEffect, useRef } from 'react';
import { renderPdfPages } from './renderPdfPages';

interface PdfViewerProps {
  bytes: Uint8Array | null;
  pageCount: number;
  selectedPage: number | null;
}

export function PdfViewer({ bytes, pageCount, selectedPage }: PdfViewerProps): JSX.Element {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!bytes || pageCount === 0) return;
    const canvases = canvasRefs.current.slice(0, pageCount);
    // pdf.js detaches the ArrayBuffer during load, so each render call
    // gets its own copy.
    const copy = new Uint8Array(bytes);
    const handle = renderPdfPages(copy, canvases);
    handle.done.catch((err: unknown) => {
      const name = (err as { name?: string })?.name;
      if (name === 'RenderingCancelledException') return;
      console.error('[PdfViewer] render failed:', err);
    });
    return (): void => {
      handle.cancel();
    };
  }, [bytes, pageCount]);

  useEffect(() => {
    if (selectedPage == null) return;
    const el = document.getElementById(`pdf-page-${selectedPage}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedPage]);

  if (pageCount === 0) {
    return (
      <section aria-label="pdf viewer">
        <p>No document loaded.</p>
      </section>
    );
  }

  return (
    <section aria-label="pdf viewer" className="pdf-viewer">
      {Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        return (
          <div key={pageNum} id={`pdf-page-${pageNum}`} className="pdf-page">
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              aria-label={`page ${pageNum}`}
            />
            <small>Page {pageNum}</small>
          </div>
        );
      })}
    </section>
  );
}
