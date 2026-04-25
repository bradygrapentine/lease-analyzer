// API choice: `renderPdfPages` returns an `AsyncIterable<RenderedPage>` so the
// caller observes each page the moment it finishes rendering. Chose the async
// iterable over a callback because the iteration boundary is a natural
// cancellation point (AbortError propagates through `return()`) and because
// tests can await each page individually without resorting to deferred
// promises. The canvas-paint work itself still happens inside this module so
// callers only need a for-await-of loop.

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (!mod.GlobalWorkerOptions.workerSrc) {
        mod.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
      }
      return mod;
    })();
  }
  return pdfjsPromise;
}

// Render a single pdf.js page to a canvas at the given scale. Shared between
// the viewer (on-screen) and the OCR pipeline (off-screen canvases).
export async function renderPageToCanvas(
  page: import('pdfjs-dist/legacy/build/pdf.mjs').PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / scale}px`;
  canvas.style.height = `${viewport.height / scale}px`;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

export interface RenderPdfPagesOptions {
  signal?: AbortSignal;
  /**
   * Test seam: if provided, used in place of `loadPdfjs()`. Not for production
   * callers. Kept on the public options type so Vitest can inject a stub
   * module without having to monkey-patch the module cache.
   */
  pdfjsForTests?: () => Promise<Pick<PdfjsModule, 'getDocument'>>;
}

export interface RenderedPage {
  /** Zero-based index into the `canvases` array that was just painted. */
  pageIndex: number;
}

function makeAbortError(): DOMException {
  return new DOMException('renderPdfPages aborted', 'AbortError');
}

/**
 * Stream-render the given pdf bytes into `canvases` (one per page). Returns an
 * `AsyncIterable` that yields once per page, in order, the moment that page's
 * canvas is painted. The caller can consume the iterable to react per-page
 * (e.g. hide a spinner) or simply `for await` to completion.
 *
 * Abort semantics: if `options.signal` aborts mid-stream the iterator rejects
 * with a `DOMException` whose `name === 'AbortError'`. In-flight `getPage` /
 * render calls are cancelled and no further pages are fetched. Aborting after
 * the iterator has completed is a no-op.
 *
 * pdf.js detaches the ArrayBuffer underlying `bytes`; callers must pass a copy
 * (see `copyBytes` in `parser/copyBytes.ts`).
 */
export function renderPdfPages(
  bytes: Uint8Array,
  canvases: Array<HTMLCanvasElement | null>,
  options: RenderPdfPagesOptions = {},
): AsyncIterable<RenderedPage> {
  const { signal, pdfjsForTests } = options;
  return {
    [Symbol.asyncIterator](): AsyncIterator<RenderedPage> {
      return createIterator(bytes, canvases, signal, pdfjsForTests);
    },
  };
}

function createIterator(
  bytes: Uint8Array,
  canvases: Array<HTMLCanvasElement | null>,
  signal: AbortSignal | undefined,
  pdfjsForTests: (() => Promise<Pick<PdfjsModule, 'getDocument'>>) | undefined,
): AsyncIterator<RenderedPage> {
  const renderTasks: Array<{ cancel: () => void }> = [];
  let loadingTask:
    | {
        promise: Promise<import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy>;
        destroy: () => Promise<void>;
      }
    | null = null;
  let doc: import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy | null = null;
  let initPromise: Promise<void> | null = null;
  let i = 0;
  let done = false;

  const onAbort = (): void => {
    for (const t of renderTasks) {
      try {
        t.cancel();
      } catch {
        // already completed; ignore
      }
    }
  };
  if (signal) signal.addEventListener('abort', onAbort);

  const cleanup = (): void => {
    if (done) return;
    done = true;
    if (signal) signal.removeEventListener('abort', onAbort);
    // Fire-and-forget destroy; pdf.js tolerates it and the test env doesn't
    // care about the returned promise.
    if (loadingTask) {
      loadingTask.destroy().catch(() => {});
    }
  };

  const init = async (): Promise<void> => {
    if (signal?.aborted) throw makeAbortError();
    const pdfjs = pdfjsForTests ? await pdfjsForTests() : await loadPdfjs();
    if (signal?.aborted) throw makeAbortError();
    loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    doc = await loadingTask.promise;
    if (signal?.aborted) throw makeAbortError();
  };

  const targetScale = devicePixelScale();

  const next = async (): Promise<IteratorResult<RenderedPage>> => {
    if (done) return { value: undefined, done: true };
    try {
      if (!initPromise) initPromise = init();
      await initPromise;

      // Skip trailing nulls / out-of-range entries until we find one to render
      // or exhaust the canvas list.
      while (i < canvases.length) {
        if (signal?.aborted) throw makeAbortError();
        const idx = i;
        const canvas = canvases[idx];
        i += 1;
        if (!canvas) continue;
        if (!doc || idx + 1 > doc.numPages) {
          cleanup();
          return { value: undefined, done: true };
        }

        const page = await doc.getPage(idx + 1);
        if (signal?.aborted) throw makeAbortError();
        const viewport = page.getViewport({ scale: targetScale });
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // No 2d context (e.g. jsdom); skip painting but still report the
          // slot as "done" so consumers can advance.
          return { value: { pageIndex: idx }, done: false };
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / targetScale}px`;
        canvas.style.height = `${viewport.height / targetScale}px`;

        const task = page.render({ canvasContext: ctx, viewport });
        renderTasks.push(task);
        await task.promise;
        if (signal?.aborted) throw makeAbortError();
        return { value: { pageIndex: idx }, done: false };
      }

      cleanup();
      return { value: undefined, done: true };
    } catch (err) {
      cleanup();
      throw err;
    }
  };

  const returnFn = async (): Promise<IteratorResult<RenderedPage>> => {
    onAbort();
    cleanup();
    return { value: undefined, done: true };
  };

  return {
    next,
    return: returnFn,
  };
}

function devicePixelScale(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(dpr, 1), 2);
}
