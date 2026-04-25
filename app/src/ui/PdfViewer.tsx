import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { renderPdfPages } from './renderPdfPages';
import { copyBytes } from '../parser/copyBytes';
import type { BoundingBox, PageText } from '../parser/types';

interface PdfViewerProps {
  bytes: Uint8Array | null;
  pageCount: number;
  selectedPage: number | null;
  pages?: PageText[];
  highlight?: BoundingBox | null;
}

export function PdfViewer({
  bytes,
  pageCount,
  selectedPage,
  pages,
  highlight,
}: PdfViewerProps): JSX.Element {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!bytes || pageCount === 0) return;
    const canvases = canvasRefs.current.slice(0, pageCount);
    const controller = new AbortController();
    // pdf.js detaches the ArrayBuffer during load, so each render call
    // gets its own copy. `renderPdfPages` streams: each iteration corresponds
    // to a single page finishing. First-paint latency is ~1 page, not N.
    const iterable = renderPdfPages(copyBytes(bytes), canvases, {
      signal: controller.signal,
    });
    void (async () => {
      try {
        for await (const _page of iterable) {
          // Canvas already painted inside renderPdfPages; nothing to do per
          // page today. Hook placeholder for future per-page reactions.
          void _page;
        }
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError' || name === 'RenderingCancelledException') return;
        console.error('[PdfViewer] render failed:', err);
      }
    })();
    return (): void => {
      controller.abort();
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

  function overlayStyle(bbox: BoundingBox, page: PageText): CSSProperties {
    // PDF coords: y increases upward. Canvas CSS coords: top-left origin.
    const left = bbox.xLeft;
    const width = Math.max(1, bbox.xRight - bbox.xLeft);
    const top = page.height - bbox.yTop;
    const height = Math.max(1, bbox.yTop - bbox.yBottom);
    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      background: 'rgba(255, 235, 59, 0.35)',
      border: '1px solid rgba(255, 193, 7, 0.9)',
      pointerEvents: 'none',
    };
  }

  return (
    <section aria-label="pdf viewer" className="pdf-viewer">
      {Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        const overlay = highlight?.page === pageNum ? highlight : null;
        const page = pages?.[i] ?? null;
        return (
          <div key={pageNum} id={`pdf-page-${pageNum}`} className="pdf-page">
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              aria-label={`page ${pageNum}`}
            />
            {overlay && page && (
              <div
                aria-hidden="true"
                className="pdf-highlight"
                style={overlayStyle(overlay, page)}
              />
            )}
            <small>Page {pageNum}</small>
          </div>
        );
      })}
    </section>
  );
}
