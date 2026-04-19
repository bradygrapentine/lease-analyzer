import type { Rule } from './types';
import type { RulePackFile } from './packSchema';

export interface RuleCollision {
  ruleId: string;
  /** The id of the pack whose rule ultimately wins. */
  winner: string;
  /**
   * Pack ids whose rule definition was displaced. `'__builtin__'` means
   * the sentinel id used for the built-in pack.
   */
  losers: string[];
}

export interface ActivePackResolution {
  rules: Rule[];
  collisions: RuleCollision[];
}

const BUILTIN_ID = '__builtin__';

/**
 * Merge the built-in pack with every enabled installed pack.
 *
 * Collision rule: **installed packs override the built-in**, and among
 * installed packs the *later* entry in `installed` wins. Returns the
 * collision list so callers can surface a warning in the UI — we never
 * throw on collision.
 */
export function resolveActiveRules(
  builtIn: Rule[],
  installed: RulePackFile[],
  enabled: Set<string>,
): ActivePackResolution {
  const byId = new Map<string, { rule: Rule; source: string }>();
  const collisions = new Map<string, RuleCollision>();

  for (const r of builtIn) {
    byId.set(r.id, { rule: r, source: BUILTIN_ID });
  }
  for (const p of installed) {
    if (!enabled.has(p.id)) continue;
    for (const r of p.rules) {
      const prev = byId.get(r.id);
      if (prev) {
        const existing = collisions.get(r.id);
        if (existing) {
          existing.losers.push(existing.winner);
          existing.winner = p.id;
        } else {
          collisions.set(r.id, {
            ruleId: r.id,
            winner: p.id,
            losers: [prev.source],
          });
        }
      }
      byId.set(r.id, { rule: r, source: p.id });
    }
  }

  return {
    rules: Array.from(byId.values(), (v) => v.rule),
    collisions: Array.from(collisions.values()),
  };
}
