import { extractPages } from './extractPages';
import { reconstructParagraphs } from './paragraphs';
import { detectSections } from './sections';
import type { LeaseDocument } from './types';

export async function parseLease(bytes: Uint8Array): Promise<LeaseDocument> {
  const pages = await extractPages(bytes);
  // Each Paragraph carries optional `lines: LineSpan[]` (Wave 28 / Part A).
  // LineSpan is plain data (numbers + nested BoundingBox object) and is
  // structured-clone-safe across the worker boundary — no serializer needed.
  const paragraphs = reconstructParagraphs(pages);
  const sections = detectSections(paragraphs);
  const raw = paragraphs.map((p) => p.text).join('\n\n');
  return { pages, paragraphs, sections, raw };
}
