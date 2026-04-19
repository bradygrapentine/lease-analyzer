type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
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

export async function renderPdfPages(
  bytes: Uint8Array,
  canvases: Array<HTMLCanvasElement | null>,
): Promise<void> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const targetScale = devicePixelScale();
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    if (!canvas) continue;
    if (i + 1 > doc.numPages) break;
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: targetScale });
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / targetScale}px`;
    canvas.style.height = `${viewport.height / targetScale}px`;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}

function devicePixelScale(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(dpr, 1), 2);
}
