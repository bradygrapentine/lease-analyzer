import type { PageText, TextItem } from './types';
import { mapPdfError } from './errors';
// Vite resolves `?url` to the bundled worker file URL (hashed in build, dev
// path in dev). pdf.js uses this URL to spawn a real Web Worker for parsing
// instead of falling back to the on-main-thread "fake worker" — Wave 50.
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (!mod.GlobalWorkerOptions.workerSrc) {
        mod.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      }
      return mod;
    })();
  }
  return pdfjsPromise;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

function toTextItem(raw: unknown): TextItem | null {
  if (typeof raw !== 'object' || raw === null || !('str' in raw) || !('transform' in raw)) {
    return null;
  }
  const r = raw as PdfTextItem;
  const [a, b, , d, e, f] = r.transform;
  const fontSize = Math.hypot(a ?? 0, b ?? 0) || d || 0;
  return {
    text: r.str,
    x: e ?? 0,
    y: f ?? 0,
    width: r.width,
    height: r.height,
    fontSize,
  };
}

export async function extractPages(bytes: Uint8Array): Promise<PageText[]> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    throw mapPdfError(err);
  }

  const pages: PageText[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const items = content.items
      .map(toTextItem)
      .filter((t): t is TextItem => t !== null && t.text.length > 0);
    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      items,
    });
  }
  return pages;
}
