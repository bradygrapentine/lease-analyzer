// Wave 10 — paragraph-shingle similarity primitives.

function normalize(text: string): string {
  // Strip hyphens with no replacement so "non-renewal" collapses to
  // "nonrenewal" (matching the unhyphenated variant). Other punctuation
  // becomes whitespace so words don't fuse across it.
  return text
    .toLowerCase()
    .replace(/-/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * k-word shingles. Default k=5: empirically the threshold where legitimate
 * lease near-duplicates clear Jaccard 0.8 while unrelated paragraphs sit
 * well below. Paragraphs shorter than k tokens produce no shingles.
 */
export function paragraphShingles(text: string, k = 5): string[] {
  const tokens = normalize(text).split(' ').filter(Boolean);
  if (tokens.length < k) return [];
  const out: string[] = [];
  for (let i = 0; i + k <= tokens.length; i++) {
    out.push(tokens.slice(i, i + k).join(' '));
  }
  return out;
}

/**
 * Jaccard similarity over two shingle multisets, treated as sets. Returns
 * 0 for two empty inputs (definition of similarity is undefined; 0 is the
 * conservative answer for "no evidence of overlap").
 */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const s of setA) if (setB.has(s)) intersection++;
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}
