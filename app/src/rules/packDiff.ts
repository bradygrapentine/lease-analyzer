import type { Rule } from './types';
import type { RulePackFile } from './packSchema';

/**
 * Fields on `Rule` that the diff compares. `jurisdictions` is intentionally
 * excluded for now — the diff view surfaces substantive rule changes, not
 * regional tagging moves. Extend this list if the UI starts surfacing more
 * per-rule attributes.
 */
export type DiffField =
  | 'severity'
  | 'category'
  | 'title'
  | 'explanation'
  | 'citation'
  | 'match';

export interface ChangedRuleDiff {
  ruleId: string;
  /** Fields whose value differs between `current` and `incoming`. */
  fields: DiffField[];
  before: Rule;
  after: Rule;
}

export interface PackDiff {
  /** Rules present in `incoming` but not in `current`. */
  added: Rule[];
  /** Rules present in `current` but not in `incoming`. */
  removed: Rule[];
  /** Same-id rules whose substantive fields differ. */
  changed: ChangedRuleDiff[];
}

function stableStringify(v: unknown): string {
  // Deterministic key-sorted JSON — matchers are small so this is cheap and
  // keeps diff results stable regardless of field insertion order.
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

function changedFields(before: Rule, after: Rule): DiffField[] {
  const out: DiffField[] = [];
  if (before.severity !== after.severity) out.push('severity');
  if (before.category !== after.category) out.push('category');
  if (before.title !== after.title) out.push('title');
  if (before.explanation !== after.explanation) out.push('explanation');
  if (before.citation !== after.citation) out.push('citation');
  if (stableStringify(before.match) !== stableStringify(after.match)) {
    out.push('match');
  }
  return out;
}

/**
 * Diff the currently-loaded rule list against an incoming pack file.
 *
 * This is used by the rule-pack import UI to show the user what will change
 * if they accept the incoming pack. It is pure and works off in-memory
 * shapes so it can be exercised in Storybook without IndexedDB.
 */
export function diffPack(
  current: readonly Rule[],
  incoming: RulePackFile,
): PackDiff {
  const currentById = new Map<string, Rule>();
  for (const r of current) currentById.set(r.id, r);

  const incomingById = new Map<string, Rule>();
  for (const r of incoming.rules) incomingById.set(r.id, r);

  const added: Rule[] = [];
  const changed: ChangedRuleDiff[] = [];
  for (const r of incoming.rules) {
    const prior = currentById.get(r.id);
    if (!prior) {
      added.push(r);
      continue;
    }
    const fields = changedFields(prior, r);
    if (fields.length > 0) {
      changed.push({ ruleId: r.id, fields, before: prior, after: r });
    }
  }

  const removed: Rule[] = [];
  for (const r of current) {
    if (!incomingById.has(r.id)) removed.push(r);
  }

  return { added, removed, changed };
}
