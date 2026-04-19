import {
  RULE_PACK_SCHEMA_VERSION,
  validatePackFile,
} from '../rules/packSchema';
import type {
  Category,
  KeywordProximityMatcher,
  LeafMatcher,
  Matcher,
  RegexMatcher,
  Rule,
  SectionAnchoredMatcher,
  Severity,
} from '../rules/types';

/**
 * Matcher-type discriminator used by the authoring form. Mirrors the
 * runtime `Matcher['type']` union so the UI selector stays in sync
 * with the rule engine.
 */
export type MatcherType = Matcher['type'];

/**
 * Child matcher variants allowed under `sectionAnchored`. The form
 * treats this as a nested selector; keep it in lockstep with
 * `LeafMatcher` in `rules/types.ts`.
 */
export type LeafMatcherType = LeafMatcher['type'];

/**
 * Everything the form tracks. All fields are strings so inputs bind
 * naturally; coercion to the real `Rule` shape happens in
 * `buildDraftRule`.
 */
export interface CustomRuleDraftForm {
  id: string;
  title: string;
  explanation: string;
  category: Category;
  severity: Severity;
  matcherType: MatcherType;
  // Regex fields (also used as the child when matcherType === 'sectionAnchored'
  // and childType === 'regex')
  regexPattern: string;
  regexFlags: string;
  // keywordProximity fields (child or top-level)
  keywordsRaw: string; // comma-separated
  windowRaw: string; // numeric string
  // sectionAnchored fields
  headingPattern: string;
  childType: LeafMatcherType;
  // Optional metadata
  jurisdictionsRaw: string; // comma-separated
  plainEnglish: string;
  suggestedEdit: string;
}

export const EMPTY_DRAFT: CustomRuleDraftForm = {
  id: '',
  title: '',
  explanation: '',
  category: 'general',
  severity: 'medium',
  matcherType: 'regex',
  regexPattern: '',
  regexFlags: 'i',
  keywordsRaw: '',
  windowRaw: '60',
  headingPattern: '',
  childType: 'regex',
  jurisdictionsRaw: '',
  plainEnglish: '',
  suggestedEdit: '',
};

export const SEVERITIES: Severity[] = ['high', 'medium', 'low', 'info'];
export const CATEGORIES: Category[] = [
  'termination',
  'fees',
  'dispute',
  'liability',
  'finance',
  'obligations',
  'general',
];
export const MATCHER_TYPES: MatcherType[] = [
  'regex',
  'keywordProximity',
  'sectionAnchored',
];
export const LEAF_MATCHER_TYPES: LeafMatcherType[] = [
  'regex',
  'keywordProximity',
];

function splitCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildRegex(form: CustomRuleDraftForm): RegexMatcher {
  const matcher: RegexMatcher = {
    type: 'regex',
    pattern: form.regexPattern,
  };
  if (form.regexFlags.length > 0) {
    matcher.flags = form.regexFlags;
  }
  return matcher;
}

function buildKeyword(form: CustomRuleDraftForm): KeywordProximityMatcher {
  const window = Number.parseInt(form.windowRaw, 10);
  return {
    type: 'keywordProximity',
    keywords: splitCsv(form.keywordsRaw),
    window: Number.isFinite(window) ? window : 0,
  };
}

function buildLeaf(
  form: CustomRuleDraftForm,
  type: LeafMatcherType,
): LeafMatcher {
  return type === 'regex' ? buildRegex(form) : buildKeyword(form);
}

function buildMatcher(form: CustomRuleDraftForm): Matcher {
  if (form.matcherType === 'regex') return buildRegex(form);
  if (form.matcherType === 'keywordProximity') return buildKeyword(form);
  const anchored: SectionAnchoredMatcher = {
    type: 'sectionAnchored',
    headingPattern: form.headingPattern,
    child: buildLeaf(form, form.childType),
  };
  return anchored;
}

/**
 * Compose the in-form state into a `Rule`. This is intentionally
 * permissive — it may produce a rule that fails `validatePackFile`
 * (e.g. empty id). Validation is a separate step so the UI can show
 * targeted errors without re-implementing the schema.
 */
export function buildDraftRule(form: CustomRuleDraftForm): Rule {
  const rule: Rule = {
    id: form.id,
    title: form.title,
    explanation: form.explanation,
    severity: form.severity,
    category: form.category,
    citation: null,
    match: buildMatcher(form),
  };
  const jurisdictions = splitCsv(form.jurisdictionsRaw);
  if (jurisdictions.length > 0) rule.jurisdictions = jurisdictions;
  if (form.plainEnglish.length > 0) rule.plainEnglish = form.plainEnglish;
  if (form.suggestedEdit.length > 0) rule.suggestedEdit = form.suggestedEdit;
  return rule;
}

export interface DraftValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a draft rule by wrapping it in a minimal single-rule pack
 * and running the existing schema validator. Keeps the source of
 * truth in `packSchema.ts` — the builder never re-implements the
 * constraints.
 */
export function validateDraftRule(rule: Rule): DraftValidation {
  const pack = {
    schema: RULE_PACK_SCHEMA_VERSION,
    id: 'draft-pack',
    name: 'Draft pack',
    version: '0.0.0',
    description: 'Synthesized for draft validation.',
    rules: [rule],
  };
  const result = validatePackFile(pack);
  if (result.ok) return { ok: true, errors: [] };
  // Strip the outer `rules[0].` prefix so errors read naturally in the UI.
  const errors = result.errors.map((e) => e.replace(/^rules\[0\]\.?/, ''));
  return { ok: false, errors };
}

/**
 * Best-effort regex-compile check. Returns the error message when the
 * pattern fails to compile so the UI can show it inline and suppress
 * the live preview. Returns `null` when the pattern is empty or when
 * the matcher type does not use a regex.
 */
export function regexCompileError(form: CustomRuleDraftForm): string | null {
  if (form.matcherType === 'regex') {
    return tryCompile(form.regexPattern, form.regexFlags);
  }
  if (form.matcherType === 'sectionAnchored') {
    const headingErr = tryCompile(form.headingPattern, '');
    if (headingErr) return headingErr;
    if (form.childType === 'regex') {
      return tryCompile(form.regexPattern, form.regexFlags);
    }
  }
  return null;
}

function tryCompile(pattern: string, flags: string): string | null {
  if (pattern.length === 0) return null;
  try {
    new RegExp(pattern, flags.length > 0 ? flags : undefined);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
