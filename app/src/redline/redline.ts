import type { LeaseDocument, Paragraph } from '../parser/types';

/**
 * A single user-authored edit to a paragraph of a lease, stored separately
 * from the source document so the original `LeaseDocument` stays immutable.
 *
 * Keyed by `(leaseId, paragraphIndex)` at the storage layer — only one
 * redline per paragraph can exist at a time; saving a new one overwrites.
 */
export interface RedlineEdit {
  leaseId: string;
  paragraphIndex: number;
  before: string; // original paragraph text (snapshot)
  after: string; // edited text
  updatedAt: string; // ISO-8601
  ruleId?: string; // set when applied from a finding / counter-offer
}

/**
 * Word/phrase-level diff chunk returned by {@link computeParagraphDiff}.
 * Rendered as `<ins>` / `<del>` inline elements inside a paragraph.
 */
export interface DiffChunk {
  kind: 'unchanged' | 'added' | 'removed';
  text: string;
}

/**
 * Return a shallow-copy `LeaseDocument` with paragraph texts replaced where
 * edits exist. Paragraphs not covered by an edit are passed through by
 * reference. Edits pointing at out-of-range indices are ignored (defensive).
 */
export function applyEdits(doc: LeaseDocument, edits: RedlineEdit[]): LeaseDocument {
  if (edits.length === 0) return doc;
  const byIndex = new Map<number, RedlineEdit>();
  for (const e of edits) {
    if (e.paragraphIndex < 0 || e.paragraphIndex >= doc.paragraphs.length) continue;
    byIndex.set(e.paragraphIndex, e);
  }
  if (byIndex.size === 0) return doc;
  const paragraphs: Paragraph[] = doc.paragraphs.map((p, i) => {
    const edit = byIndex.get(i);
    if (!edit) return p;
    return { ...p, text: edit.after };
  });
  return { ...doc, paragraphs };
}

export interface BuildRedlineHtmlInput {
  leaseName: string;
  doc: LeaseDocument;
  edits: RedlineEdit[];
}

/**
 * Render a redlined HTML document. Unedited paragraphs are wrapped in a
 * `<p>`. Edited paragraphs render inline `<ins>` / `<del>` spans produced by
 * {@link computeParagraphDiff}. The stylesheet includes a `@media print`
 * block so the output prints cleanly.
 *
 * Invariants:
 * - With zero edits (or only edits for out-of-range paragraphs), the output
 *   contains no `<ins>` or `<del>` tags.
 * - Out-of-range paragraph indices are silently dropped.
 */
export function buildRedlineHtml(input: BuildRedlineHtmlInput): string {
  const { leaseName, doc, edits } = input;
  const byIndex = new Map<number, RedlineEdit>();
  for (const e of edits) {
    if (e.paragraphIndex < 0 || e.paragraphIndex >= doc.paragraphs.length) continue;
    byIndex.set(e.paragraphIndex, e);
  }

  const paragraphsHtml = doc.paragraphs
    .map((p, i) => {
      const edit = byIndex.get(i);
      if (!edit || edit.before === edit.after) {
        return `<p class="para" data-para-index="${i}">${escapeHtml(p.text)}</p>`;
      }
      const chunks = computeParagraphDiff(edit.before, edit.after);
      const body = chunks.map(renderChunk).join('');
      return `<p class="para para-edited" data-para-index="${i}">${body}</p>`;
    })
    .join('\n');

  const generatedAt = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(leaseName)} \u00b7 LeaseGuard redline</title>
<style>
  /* Marginalia palette inlined: ins=Sage Note tint, del=Negative Red tint. */
  body { font-family: 'Source Serif 4', 'Iowan Old Style', Georgia, serif; background: #faf6ee; color: #4a3f25; max-width: 65ch; margin: 0 auto; padding: 2rem 1rem; line-height: 1.55; }
  h1 { font-weight: 600; color: #2a2316; margin-bottom: 0.25rem; }
  .meta { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #7a6f57; font-size: 0.8125rem; margin-bottom: 2rem; }
  .para { margin: 0 0 1rem; }
  ins { background: rgba(90, 122, 90, 0.18); text-decoration: none; color: #2a2316; padding: 0 0.1em; }
  del { background: rgba(154, 48, 34, 0.16); color: #2a2316; padding: 0 0.1em; }
  @media print {
    body { background: transparent; max-width: none; padding: 0; }
    .para { page-break-inside: avoid; }
    ins { background: transparent; color: #2a2316; text-decoration: underline; }
    del { background: transparent; color: #2a2316; text-decoration: line-through; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(leaseName)}</h1>
<p class="meta">
  ${doc.paragraphs.length} paragraph${doc.paragraphs.length === 1 ? '' : 's'} \u00b7
  ${byIndex.size} edit${byIndex.size === 1 ? '' : 's'} \u00b7
  Generated ${generatedAt}
</p>
${paragraphsHtml}
</body>
</html>`;
}

function renderChunk(c: DiffChunk): string {
  const text = escapeHtml(c.text);
  if (c.kind === 'added') return `<ins>${text}</ins>`;
  if (c.kind === 'removed') return `<del>${text}</del>`;
  return text;
}

/**
 * Word-level diff based on the classic LCS (longest common subsequence)
 * dynamic-programming table. Runs purely in-memory; intended for paragraph-
 * sized strings so the O(N*M) table is fine. Whitespace between words is
 * preserved by tokenising into word + separator chunks.
 *
 * The output is minimal: consecutive chunks of the same kind are merged.
 */
export function computeParagraphDiff(before: string, after: string): DiffChunk[] {
  if (before === after) {
    if (before.length === 0) return [];
    return [{ kind: 'unchanged', text: before }];
  }
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length === 0) return b.length === 0 ? [] : merge([{ kind: 'added', text: after }]);
  if (b.length === 0) return merge([{ kind: 'removed', text: before }]);

  // LCS table.
  const n = a.length;
  const m = b.length;
  const dp: number[] = new Array((n + 1) * (m + 1)).fill(0) as number[];
  const idx = (i: number, j: number): number => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[idx(i, j)] = (dp[idx(i + 1, j + 1)] ?? 0) + 1;
      } else {
        dp[idx(i, j)] = Math.max(dp[idx(i + 1, j)] ?? 0, dp[idx(i, j + 1)] ?? 0);
      }
    }
  }

  // Walk the table to emit chunks.
  const out: DiffChunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'unchanged', text: a[i] ?? '' });
      i++;
      j++;
    } else if ((dp[idx(i + 1, j)] ?? 0) >= (dp[idx(i, j + 1)] ?? 0)) {
      out.push({ kind: 'removed', text: a[i] ?? '' });
      i++;
    } else {
      out.push({ kind: 'added', text: b[j] ?? '' });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: 'removed', text: a[i] ?? '' });
    i++;
  }
  while (j < m) {
    out.push({ kind: 'added', text: b[j] ?? '' });
    j++;
  }
  return merge(out);
}

/**
 * Split into a sequence of alternating word / whitespace tokens so diff
 * output preserves spacing. Empty string yields an empty array.
 */
function tokenize(s: string): string[] {
  if (s.length === 0) return [];
  // Greedy: words (non-space) and whitespace runs.
  const tokens = s.match(/\s+|\S+/g);
  return tokens ?? [];
}

function merge(chunks: DiffChunk[]): DiffChunk[] {
  const out: DiffChunk[] = [];
  for (const c of chunks) {
    if (c.text.length === 0) continue;
    const last = out[out.length - 1];
    if (last && last.kind === c.kind) {
      out[out.length - 1] = { kind: c.kind, text: last.text + c.text };
    } else {
      out.push(c);
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
