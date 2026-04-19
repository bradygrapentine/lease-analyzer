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

export interface RenderHandle {
  done: Promise<void>;
  cancel: () => void;
}

export function renderPdfPages(
  bytes: Uint8Array,
  canvases: Array<HTMLCanvasElement | null>,
): RenderHandle {
  let cancelled = false;
  const tasks: Array<{ cancel: () => void }> = [];

  const done = (async (): Promise<void> => {
    const pdfjs = await loadPdfjs();
    if (cancelled) return;
    const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const doc = await loadingTask.promise;
    if (cancelled) return;

    const targetScale = devicePixelScale();
    for (let i = 0; i < canvases.length; i++) {
      if (cancelled) return;
      const canvas = canvases[i];
      if (!canvas) continue;
      if (i + 1 > doc.numPages) break;

      const page = await doc.getPage(i + 1);
      if (cancelled) return;
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
  })();

  return {
    done,
    cancel: (): void => {
      cancelled = true;
      for (const t of tasks) {
        try {
          t.cancel();
        } catch {
          // already completed; ignore
        }
      }
    },
  };
}

function devicePixelScale(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(dpr, 1), 2);
}
