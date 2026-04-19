import type { Rule } from './types';

/**
 * Curated list of jurisdiction codes surfaced in the picker UI. Extending
 * is deliberately cheap — append and ship; no downstream store migrations
 * required because `selectedJurisdictions` is just `string[]`.
 */
export interface JurisdictionOption {
  code: string;
  label: string;
}

export const JURISDICTION_OPTIONS: readonly JurisdictionOption[] = [
  { code: 'US-CA', label: 'United States — California' },
  { code: 'US-NY', label: 'United States — New York' },
  { code: 'US-TX', label: 'United States — Texas' },
  { code: 'US-FL', label: 'United States — Florida' },
  { code: 'UK-ENG', label: 'United Kingdom — England' },
  { code: 'CA-ON', label: 'Canada — Ontario' },
] as const;

/**
 * Filter `rules` by the user's selected jurisdictions.
 *
 * Semantics:
 * - A rule with no `jurisdictions` field (or an empty array) is treated as
 *   "applies everywhere" and always passes.
 * - If the user has not selected any jurisdictions yet (`selected.length === 0`)
 *   we treat that as "no filter active" and return all rules. This keeps
 *   first-run behavior sane: users who never open the picker don't silently
 *   lose tagged rules.
 * - Otherwise a tagged rule passes iff at least one of its jurisdictions
 *   appears in `selected`.
 */
export function filterByJurisdiction(
  rules: readonly Rule[],
  selected: readonly string[],
): Rule[] {
  if (selected.length === 0) return rules.slice();
  const set = new Set(selected);
  return rules.filter((r) => {
    const tags = r.jurisdictions;
    if (!tags || tags.length === 0) return true;
    return tags.some((t) => set.has(t));
  });
}
