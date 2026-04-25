// Wave 10 Part B — paragraph shingles + Jaccard similarity.
//
// `paragraphShingles` produces order-preserving k-shingles (overlapping
// k-token windows) over a normalized form of the input: lowercased,
// punctuation stripped, whitespace collapsed. The output is suitable for
// set-based similarity scoring via `jaccard`.
//
// `jaccard` treats its inputs as sets — duplicates do not change the
// score. Two empty inputs return 0 (an undefined ratio); we collapse to
// 0 so callers can safely threshold against >= some value.

export function paragraphShingles(text: string, k: number = 5): string[] {
  if (!text || k <= 0) return [];
  const normalized = text
    .toLowerCase()
    // Drop hyphens / apostrophes WITHIN words (non-renewal → nonrenewal,
    // tenant's → tenants) so common typographic variants collapse to the
    // same token before we strip remaining punctuation.
    .replace(/(\p{L})[’'-](\p{L})/gu, '$1$2')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  const tokens = normalized.split(' ');
  if (tokens.length < k) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    out.push(tokens.slice(i, i + k).join(' '));
  }
  return out;
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}
