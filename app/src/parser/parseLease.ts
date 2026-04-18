import { extractPages } from './extractPages';
import { reconstructParagraphs } from './paragraphs';
import { detectSections } from './sections';
import type { LeaseDocument } from './types';

export async function parseLease(bytes: Uint8Array): Promise<LeaseDocument> {
  const pages = await extractPages(bytes);
  const paragraphs = reconstructParagraphs(pages);
  const sections = detectSections(paragraphs);
  const raw = paragraphs.map((p) => p.text).join('\n\n');
  return { pages, paragraphs, sections, raw };
}
