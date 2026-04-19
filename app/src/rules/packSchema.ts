import type { Category, Rule, Severity } from './types';

export const RULE_PACK_SCHEMA_VERSION = 'leaseguard.rulepack.v1';

export interface RulePackFile {
  schema: typeof RULE_PACK_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  description: string;
  rules: Rule[];
}

const SEVERITIES: Severity[] = ['high', 'medium', 'low', 'info'];
const CATEGORIES: Category[] = [
  'termination',
  'fees',
  'dispute',
  'liability',
  'finance',
  'obligations',
  'general',
];

type ValidationResult =
  | { ok: true; pack: RulePackFile }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pushRequiredString(
  errs: string[],
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    errs.push(`${path}.${key} must be a non-empty string`);
  }
}

function validateMatcher(m: unknown, path: string, errs: string[]): void {
  if (!isPlainObject(m)) {
    errs.push(`${path} must be a matcher object`);
    return;
  }
  const type = m['type'];
  if (type === 'regex') {
    if (typeof m['pattern'] !== 'string' || m['pattern'].length === 0) {
      errs.push(`${path}.pattern must be a non-empty string`);
      return;
    }
    const flags = m['flags'];
    if (flags !== undefined && typeof flags !== 'string') {
      errs.push(`${path}.flags must be a string when present`);
      return;
    }
    try {
      new RegExp(m['pattern'], typeof flags === 'string' ? flags : undefined);
    } catch (e) {
      errs.push(`${path}.pattern is not a valid regex: ${(e as Error).message}`);
    }
    return;
  }
  if (type === 'keywordProximity') {
    const kws = m['keywords'];
    if (
      !Array.isArray(kws) ||
      kws.length < 2 ||
      !kws.every((k) => typeof k === 'string' && k.length > 0)
    ) {
      errs.push(`${path}.keywords must be an array of 2+ non-empty strings`);
    }
    const win = m['window'];
    if (typeof win !== 'number' || !Number.isFinite(win) || win <= 0) {
      errs.push(`${path}.window must be a positive number`);
    }
    return;
  }
  if (type === 'sectionAnchored') {
    if (typeof m['headingPattern'] !== 'string' || m['headingPattern'].length === 0) {
      errs.push(`${path}.headingPattern must be a non-empty string`);
    } else {
      try {
        new RegExp(m['headingPattern']);
      } catch (e) {
        errs.push(`${path}.headingPattern is not a valid regex: ${(e as Error).message}`);
      }
    }
    const child = m['child'];
    if (!isPlainObject(child)) {
      errs.push(`${path}.child must be a leaf matcher object`);
      return;
    }
    if (child['type'] !== 'regex' && child['type'] !== 'keywordProximity') {
      errs.push(`${path}.child must be a regex or keywordProximity matcher`);
      return;
    }
    validateMatcher(child, `${path}.child`, errs);
    return;
  }
  errs.push(`${path}.type is not a known matcher type (${String(type)})`);
}

function validateRule(rule: unknown, path: string, errs: string[]): void {
  if (!isPlainObject(rule)) {
    errs.push(`${path} must be an object`);
    return;
  }
  pushRequiredString(errs, rule, 'id', path);
  pushRequiredString(errs, rule, 'title', path);
  pushRequiredString(errs, rule, 'explanation', path);

  const sev = rule['severity'];
  if (typeof sev !== 'string' || !SEVERITIES.includes(sev as Severity)) {
    errs.push(`${path}.severity must be one of ${SEVERITIES.join('|')}`);
  }
  const cat = rule['category'];
  if (typeof cat !== 'string' || !CATEGORIES.includes(cat as Category)) {
    errs.push(`${path}.category must be one of ${CATEGORIES.join('|')}`);
  }
  const citation = rule['citation'];
  if (citation !== null && typeof citation !== 'string') {
    errs.push(`${path}.citation must be a string or null`);
  }
  if (!('match' in rule)) {
    errs.push(`${path}.match is required`);
  } else {
    validateMatcher(rule['match'], `${path}.match`, errs);
  }

  // Phase 10b: optional jurisdictions tag array.
  if ('jurisdictions' in rule && rule['jurisdictions'] !== undefined) {
    const j = rule['jurisdictions'];
    if (
      !Array.isArray(j) ||
      !j.every((c) => typeof c === 'string' && c.length > 0)
    ) {
      errs.push(`${path}.jurisdictions must be an array of non-empty strings`);
    }
  }
}

export function validatePackFile(json: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(json)) {
    return { ok: false, errors: ['pack file must be a JSON object'] };
  }
  if (json['schema'] !== RULE_PACK_SCHEMA_VERSION) {
    errors.push(`schema must equal "${RULE_PACK_SCHEMA_VERSION}"`);
  }
  pushRequiredString(errors, json, 'id', 'pack');
  pushRequiredString(errors, json, 'name', 'pack');
  pushRequiredString(errors, json, 'version', 'pack');
  pushRequiredString(errors, json, 'description', 'pack');

  const rules = json['rules'];
  if (!Array.isArray(rules)) {
    errors.push('pack.rules must be an array');
    return { ok: false, errors };
  }

  rules.forEach((r, i) => validateRule(r, `rules[${i}]`, errors));

  const seen = new Set<string>();
  for (const r of rules) {
    if (isPlainObject(r) && typeof r['id'] === 'string') {
      if (seen.has(r['id'])) {
        errors.push(`duplicate rule id "${r['id']}" in pack`);
      }
      seen.add(r['id']);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Safe-cast: every required field validated above.
  return { ok: true, pack: json as unknown as RulePackFile };
}
