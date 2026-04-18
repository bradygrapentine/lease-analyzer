export { analyze, RULE_PACK_VERSION } from './analyze';
export { RULE_PACK_V1 } from './packV1';
export { runMatcher, runRegex, runKeywordProximity } from './matchers';
export type {
  Rule,
  Matcher,
  LeafMatcher,
  RegexMatcher,
  KeywordProximityMatcher,
  SectionAnchoredMatcher,
  Finding,
  Severity,
  Category,
  Span,
  RuleMatch,
} from './types';
