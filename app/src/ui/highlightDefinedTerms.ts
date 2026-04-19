import { createElement, type ReactNode } from 'react';
import type { DefinitionEntry } from '../facts/types';

/**
 * Wrap whole-word occurrences of defined terms inside `text` with a
 * `<dfn title="…">` element so that hovering reveals the definition.
 *
 * - Match is case-insensitive, but the original casing in `text` is
 *   preserved inside the wrapper.
 * - Overlapping terms resolve by preferring the longer term (e.g. a match
 *   for "Base Rent" wins over "Rent").
 * - Entries are deduplicated by lowercased term; empty-term entries are
 *   ignored.
 * - Returns an array of React nodes; when there are no matches (or no
 *   usable entries) the array is just `[text]`, cheap for the caller to
 *   render directly.
 */
export function highlightDefinedTerms(
  text: string,
  entries: DefinitionEntry[],
): ReactNode[] {
  if (entries.length === 0 || text.length === 0) return [text];

  // Deduplicate by lowercased term, preserving the first definition seen.
  const byKey = new Map<string, DefinitionEntry>();
  for (const e of entries) {
    const term = e.term;
    if (!term) continue;
    const key = term.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, e);
  }
  if (byKey.size === 0) return [text];

  const usable = Array.from(byKey.values());

  interface Hit {
    start: number;
    end: number;
    entry: DefinitionEntry;
  }

  // Collect every candidate match across all terms, then resolve overlaps.
  const hits: Hit[] = [];
  for (const entry of usable) {
    const re = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, entry });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  if (hits.length === 0) return [text];

  // Sort by start, then by length descending so the longer overlap wins.
  hits.sort(
    (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start),
  );
  const resolved: Hit[] = [];
  let cursor = -1;
  for (const h of hits) {
    if (h.start < cursor) continue; // Overlaps an already-accepted longer hit.
    resolved.push(h);
    cursor = h.end;
  }

  const nodes: ReactNode[] = [];
  let pos = 0;
  resolved.forEach((h, i) => {
    if (h.start > pos) nodes.push(text.slice(pos, h.start));
    const slice = text.slice(h.start, h.end);
    nodes.push(
      createElement(
        'dfn',
        {
          key: `dfn-${i}-${h.start}`,
          title: h.entry.definition,
          className: 'defined-term',
        },
        slice,
      ),
    );
    pos = h.end;
  });
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
