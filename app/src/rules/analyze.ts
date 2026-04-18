import type { LeaseDocument } from '../parser/types';
import { runMatcher } from './matchers';
import type { Finding, Rule } from './types';

export const RULE_PACK_VERSION = '1.0.0';

const NEGATION_WINDOW = 30;
const NEGATION_TOKENS = [
  'not',
  'no',
  'never',
  'without',
  'shall not',
  'does not',
  'do not',
  'neither',
  'nor',
  'except',
];

export function analyze(doc: LeaseDocument, rules: Rule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    const matches = runMatcher(rule.match, doc);
    for (const match of matches) {
      const para = doc.paragraphs[match.paragraphIndex];
      if (!para) continue;
      const negated = isNegatedContext(para.text, match.span.start);
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        title: rule.title,
        explanation: rule.explanation,
        citation: rule.citation,
        page: para.page,
        paragraphIndex: match.paragraphIndex,
        snippet: match.snippet,
        span: match.span,
        confidence: negated ? match.confidence * 0.5 : match.confidence,
        negated,
        rulePackVersion: RULE_PACK_VERSION,
      });
    }
  }
  return sortFindings(findings);
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.paragraphIndex !== b.paragraphIndex) return a.paragraphIndex - b.paragraphIndex;
    if (a.span.start !== b.span.start) return a.span.start - b.span.start;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function isNegatedContext(text: string, spanStart: number): boolean {
  const windowStart = Math.max(0, spanStart - NEGATION_WINDOW);
  const prefix = text.slice(windowStart, spanStart).toLowerCase();
  return NEGATION_TOKENS.some((token) => new RegExp(`\\b${token}\\b`).test(prefix));
}
