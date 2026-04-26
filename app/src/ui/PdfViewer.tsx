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
      // Honor `prefers-reduced-motion` so the scroll respects the OS-level
      // motion preference (WCAG 2.3.3). Fall back to `smooth` when the
      // media query is unavailable (jsdom) or the user hasn't opted in.
      const reduceMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
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
    // Clamp the overlay to the page viewport so a finding whose bbox
    // overshoots (landscape / oversized fonts) doesn't render past the
    // canvas edges and bleed into adjacent layout.
    const rawLeft = bbox.xLeft;
    const rawWidth = Math.max(1, bbox.xRight - bbox.xLeft);
    const rawTop = page.height - bbox.yTop;
    const rawHeight = Math.max(1, bbox.yTop - bbox.yBottom);
    const left = Math.max(0, rawLeft);
    const top = Math.max(0, rawTop);
    const width = Math.max(1, Math.min(rawLeft + rawWidth, page.width) - left);
    const height = Math.max(1, Math.min(rawTop + rawHeight, page.height) - top);
    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      background: 'var(--color-highlight)',
      border: '1px solid var(--color-highlight-border)',
      pointerEvents: 'none',
    };
  }

  return (
    <section aria-label="pdf viewer" className="pdf-viewer">
      <div className="pdf-viewer-legacy">
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
      </div>
    </section>
  );
}
