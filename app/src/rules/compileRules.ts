import type {
  KeywordProximityMatcher,
  LeafMatcher,
  Matcher,
  RegexMatcher,
  Rule,
  SectionAnchoredMatcher,
} from './types';

/**
 * Per-matcher compiled artefacts. Produced once by {@link compileRule} and
 * cached on the rule so hot paths (`analyze` → `runMatcher`) don't repeat
 * `new RegExp(...)` or per-keyword `.toLowerCase()` allocations on every
 * invocation.
 *
 * All fields are optional — a compiled rule that uses only keyword-proximity
 * will have no `regex`, and vice versa. The cache is purely advisory:
 * runtime paths fall back to the uncompiled behaviour when a field is
 * missing so callers that hand-construct rules still work.
 */
export interface CompiledMatcherCache {
  /** Pre-built RegExp for `regex` matchers (global flag already ensured). */
  regex?: RegExp;
  /** Pre-built RegExp for `sectionAnchored` matchers' heading pattern. */
  headingRegex?: RegExp;
  /** Pre-lowercased keyword list for `keywordProximity`. */
  keywordsLower?: string[];
  /** Recursively compiled child (only set for `sectionAnchored`). */
  child?: CompiledMatcherCache;
}

/**
 * A {@link Rule} augmented with a pre-compiled matcher cache. The cache
 * lives on the optional `__compiled` field so existing consumers that
 * iterate `Rule` properties keep working unchanged.
 */
export interface CompiledRule extends Rule {
  __compiled?: CompiledMatcherCache;
}

/**
 * Thrown by {@link compileRule} / {@link compileRules} when a rule's regex
 * or nested regex fails to compile. The containing `ruleId` plus a short
 * `reason` are attached so UI code can surface a meaningful error without
 * having to re-parse the message string.
 */
export class RuleCompilationError extends Error {
  readonly ruleId: string;
  readonly reason: string;
  constructor(ruleId: string, reason: string) {
    super(`Failed to compile rule "${ruleId}": ${reason}`);
    this.name = 'RuleCompilationError';
    this.ruleId = ruleId;
    this.reason = reason;
  }
}

/**
 * Compile a single rule, producing a {@link CompiledRule} whose `__compiled`
 * field holds pre-built RegExp / keyword artefacts for every matcher in the
 * tree. Idempotent: re-compiling an already-compiled rule rebuilds the
 * cache (cheap; callers usually go through {@link compileRules} anyway).
 *
 * Throws {@link RuleCompilationError} if any embedded regex pattern is
 * invalid — the error carries the rule id so callers can pinpoint the
 * offending rule in an imported pack.
 */
export function compileRule(rule: Rule): CompiledRule {
  const cache = compileMatcher(rule.match, rule.id);
  return { ...rule, __compiled: cache };
}

/**
 * Compile an array of rules. Short-circuits on the first
 * {@link RuleCompilationError} — the caller sees the failing rule id and
 * no partial array is returned.
 */
export function compileRules(rules: Rule[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const rule of rules) {
    out.push(compileRule(rule));
  }
  return out;
}

/**
 * Type guard used by `analyze` and friends to decide whether a rule array
 * is already compiled. A rule counts as compiled if *every* element has a
 * `__compiled` cache, so we can cheaply skip the recompile step on hot
 * paths without forcing callers to thread an explicit boolean flag through.
 */
export function isCompiledRules(rules: readonly Rule[]): rules is CompiledRule[] {
  if (rules.length === 0) return false;
  for (const r of rules) {
    if (!(r as CompiledRule).__compiled) return false;
  }
  return true;
}

function compileMatcher(matcher: Matcher, ruleId: string): CompiledMatcherCache {
  if (matcher.type === 'sectionAnchored') {
    return compileSectionAnchored(matcher, ruleId);
  }
  return compileLeaf(matcher, ruleId);
}

function compileLeaf(matcher: LeafMatcher, ruleId: string): CompiledMatcherCache {
  if (matcher.type === 'regex') return compileRegex(matcher, ruleId);
  return compileKeywordProximity(matcher);
}

function compileRegex(matcher: RegexMatcher, ruleId: string): CompiledMatcherCache {
  const rawFlags = matcher.flags ?? '';
  const flags = rawFlags.includes('g') ? rawFlags : `${rawFlags}g`;
  try {
    return { regex: new RegExp(matcher.pattern, flags) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new RuleCompilationError(ruleId, reason);
  }
}

function compileKeywordProximity(matcher: KeywordProximityMatcher): CompiledMatcherCache {
  return { keywordsLower: matcher.keywords.map((k) => k.toLowerCase()) };
}

function compileSectionAnchored(
  matcher: SectionAnchoredMatcher,
  ruleId: string,
): CompiledMatcherCache {
  let headingRegex: RegExp;
  try {
    headingRegex = new RegExp(matcher.headingPattern, 'i');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new RuleCompilationError(ruleId, reason);
  }
  return {
    headingRegex,
    child: compileLeaf(matcher.child, ruleId),
  };
}
