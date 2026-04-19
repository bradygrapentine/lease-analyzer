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
}

function makeAbortError(): DOMException {
  return new DOMException('renderPdfPages aborted', 'AbortError');
}

/**
 * Render the given pdf bytes into `canvases` (one per page). Resolves when
 * rendering completes. If `options.signal` aborts mid-flight, the returned
 * promise rejects with a `DOMException` whose `name === 'AbortError'`. If the
 * signal aborts after rendering has already resolved it is a no-op.
 *
 * Note: pdf.js transfers ownership of the ArrayBuffer underlying `bytes`;
 * callers must pass a copy (see `copyBytes` in `parser/copyBytes.ts`).
 */
export function renderPdfPages(
  bytes: Uint8Array,
  canvases: Array<HTMLCanvasElement | null>,
  options: RenderPdfPagesOptions = {},
): Promise<void> {
  const { signal } = options;
  const tasks: Array<{ cancel: () => void }> = [];

  const onAbort = (): void => {
    for (const t of tasks) {
      try {
        t.cancel();
      } catch {
        // already completed; ignore
      }
    }
  };
  if (signal) signal.addEventListener('abort', onAbort);

  const run = async (): Promise<void> => {
    try {
      if (signal?.aborted) throw makeAbortError();
      const pdfjs = await loadPdfjs();
      if (signal?.aborted) throw makeAbortError();
      const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
      const doc = await loadingTask.promise;
      if (signal?.aborted) throw makeAbortError();

      const targetScale = devicePixelScale();
      for (let i = 0; i < canvases.length; i++) {
        if (signal?.aborted) throw makeAbortError();
        const canvas = canvases[i];
        if (!canvas) continue;
        if (i + 1 > doc.numPages) break;

        const page = await doc.getPage(i + 1);
        if (signal?.aborted) throw makeAbortError();
        const viewport = page.getViewport({ scale: targetScale });
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / targetScale}px`;
        canvas.style.height = `${viewport.height / targetScale}px`;

        const task = page.render({ canvasContext: ctx, viewport });
        tasks.push(task);
        await task.promise;
      }
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  };

  return run();
}

function devicePixelScale(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(dpr, 1), 2);
}
