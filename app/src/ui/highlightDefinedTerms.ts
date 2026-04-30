import { createElement, type ReactNode } from 'react';
import type { DefinitionEntry } from '../facts/types';
import type { GlossaryEntry } from '../glossary/loadGlossary';
import { GlossaryTerm } from './GlossaryTerm';

/**
 * Minimal shape used internally — both DefinitionEntry (lease-defined
 * terms) and GlossaryEntry (static legal glossary) collapse to this.
 */
interface TermLike {
  term: string;
  definition: string;
}

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
 *
 * Wave 11: an optional `glossary` of static legal terms can be passed.
 * Lease-defined terms always win over glossary entries on duplicate
 * terms (the document's own definition is more specific than the
 * generic legal explainer). Glossary-only matches receive an extra
 * `glossary` className token so the UI can theme them differently.
 */
export function highlightDefinedTerms(
  text: string,
  entries: DefinitionEntry[],
  glossary?: GlossaryEntry[],
  options?: { interactive?: boolean },
): ReactNode[] {
  if (text.length === 0) return [text];
  if (entries.length === 0 && (!glossary || glossary.length === 0)) return [text];

  // Deduplicate by lowercased term. Lease-defined entries win over
  // glossary entries when both define the same term.
  const byKey = new Map<string, { entry: TermLike; source: 'lease' | 'glossary' }>();
  for (const e of entries) {
    if (!e.term) continue;
    const key = e.term.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { entry: e, source: 'lease' });
  }
  if (glossary) {
    for (const e of glossary) {
      if (!e.term) continue;
      const key = e.term.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { entry: e, source: 'glossary' });
    }
  }
  if (byKey.size === 0) return [text];

  const usable = Array.from(byKey.values());

  interface Hit {
    start: number;
    end: number;
    entry: TermLike;
    source: 'lease' | 'glossary';
  }

  // Collect every candidate match across all terms, then resolve overlaps.
  const hits: Hit[] = [];
  for (const { entry, source } of usable) {
    const re = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, entry, source });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  if (hits.length === 0) return [text];

  // Sort by start, then by length descending so the longer overlap wins.
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
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
    // Wave 51-E — `<GlossaryTerm>` replaces the prior `<dfn title>` tooltip
    // so keyboard + screen-reader users can reach the definition. The
    // `defined-term` / `glossary` classes are preserved for any remaining
    // CSS hooks that depended on them.
    nodes.push(
      createElement(GlossaryTerm, {
        key: `dfn-${i}-${h.start}`,
        term: h.entry.term,
        definition: h.entry.definition,
        source: h.source,
        interactive: options?.interactive ?? true,
        children: slice,
      }),
    );
    pos = h.end;
  });
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
