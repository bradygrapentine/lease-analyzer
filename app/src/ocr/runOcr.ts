import { loadPdfjs, renderPageToCanvas } from '../ui/renderPdfPages';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, PageText, Paragraph } from '../parser/types';

export interface OcrProgress {
  pct: number; // 0..1
  stage: string; // short human-readable stage label
}

export interface RunOcrOptions {
  onProgress?: (p: OcrProgress) => void;
  // Rendering scale; higher = better OCR quality, larger canvas.
  scale?: number;
  // Tesseract language code (e.g. `'eng'`, `'spa'`). Must correspond to a
  // `<code>.traineddata.gz` file present in `public/tesseract/`. Defaults
  // to `'eng'` so existing callers are unaffected.
  language?: string;
  // Override the same-origin asset paths. Useful for tests.
  workerPath?: string;
  corePath?: string;
  langPath?: string;
}

// Default same-origin paths served from public/tesseract/. CSP is
// `default-src 'self'`, so loading tesseract assets from any CDN is blocked.
const DEFAULT_WORKER_PATH = '/tesseract/worker.min.js';
const DEFAULT_CORE_PATH = '/tesseract/tesseract-core.wasm.js';
const DEFAULT_LANG_PATH = '/tesseract';
const DEFAULT_LANGUAGE = 'eng';
const DEFAULT_SCALE = 2;

// Creates a canvas for off-screen rendering. `OffscreenCanvas` would be nicer
// but pdf.js and tesseract both accept a regular <canvas>, and jsdom in tests
// exposes `document.createElement('canvas')`.
function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

// Split OCR text into paragraphs on blank lines. Bbox is intentionally
// undefined — we do not reconstruct geometry from tesseract words here.
function splitIntoParagraphs(text: string, page: number): Paragraph[] {
  return text
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0)
    .map((t) => ({ page, text: t }));
}

export async function runOcr(
  bytes: Uint8Array,
  opts: RunOcrOptions = {},
): Promise<LeaseDocument> {
  const { onProgress, scale = DEFAULT_SCALE } = opts;
  const workerPath = opts.workerPath ?? DEFAULT_WORKER_PATH;
  const corePath = opts.corePath ?? DEFAULT_CORE_PATH;
  const langPath = opts.langPath ?? DEFAULT_LANG_PATH;
  const language = opts.language ?? DEFAULT_LANGUAGE;

  onProgress?.({ pct: 0, stage: 'loading pdf' });

  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const numPages = doc.numPages;

  onProgress?.({ pct: 0.05, stage: 'loading ocr engine' });

  // Lazy-import tesseract.js so non-OCR users never pay the bundle cost.
  const tesseract = await import('tesseract.js');

  const pages: PageText[] = [];
  const allParagraphs: Paragraph[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const canvas = makeCanvas();
    await renderPageToCanvas(page, canvas, scale);

    onProgress?.({
      pct: 0.1 + ((i - 1) / numPages) * 0.85,
      stage: `ocr page ${i}/${numPages}`,
    });

    const result = await tesseract.recognize(canvas, language, {
      workerPath,
      corePath,
      langPath,
    } as unknown as Parameters<typeof tesseract.recognize>[2]);

    const text = result?.data?.text ?? '';
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      items: [], // OCR path does not reconstruct per-glyph items
    });
    const paragraphs = splitIntoParagraphs(text, i);
    allParagraphs.push(...paragraphs);
  }

  onProgress?.({ pct: 1, stage: 'done' });

  const sections = detectSections(allParagraphs);
  const raw = allParagraphs.map((p) => p.text).join('\n\n');
  return { pages, paragraphs: allParagraphs, sections, raw };
}
