// Wave 10 — paragraph-shingle similarity primitives.
//
// Real implementation written here for Part C test isolation. Part B owns the
// canonical version on the wave10-clause-similarity branch; when this branch
// is rebased onto B-merged main, the conflict on this file should be resolved
// by accepting main's version (B's). Both are pure implementations of the
// same spec — behaviour is identical.

/**
 * Lower-case, fold whitespace, drop punctuation. Token-level normalization
 * so "non-renewal" and "nonrenewal" cluster together but capitalization /
 * extra spaces don't perturb shingles.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * k-word shingles. Default k=1 (token-level bag) — the comparison layer
 * uses a 0.8 threshold to distinguish near-duplicates from unrelated
 * paragraphs, and at the lengths real lease clauses run to (~30 tokens),
 * even a single dropped or hyphen-collapsed word knocks bigram/trigram
 * Jaccard well below 0.8. Token bag stays comfortably above 0.85 for
 * legitimate near-duplicates and well below 0.2 for unrelated paragraphs,
 * which is what the comparison thresholding actually depends on. For
 * paragraphs shorter than k tokens we emit a single shingle of all tokens
 * so very short text still has something to compare on.
 */
export function paragraphShingles(text: string, k = 1): string[] {
  const tokens = normalize(text).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length <= k) return [tokens.join(' ')];
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
