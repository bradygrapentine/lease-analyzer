export type Severity = 'high' | 'medium' | 'low' | 'info';

export type Category =
  | 'termination'
  | 'fees'
  | 'dispute'
  | 'liability'
  | 'finance'
  | 'obligations'
  | 'general';

export interface RegexMatcher {
  type: 'regex';
  pattern: string;
  flags?: string;
}

export interface KeywordProximityMatcher {
  type: 'keywordProximity';
  keywords: string[];
  window: number;
}

export interface SectionAnchoredMatcher {
  type: 'sectionAnchored';
  headingPattern: string;
  child: LeafMatcher;
}

export type LeafMatcher = RegexMatcher | KeywordProximityMatcher;
export type Matcher = LeafMatcher | SectionAnchoredMatcher;

export interface Rule {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  explanation: string;
  citation: string | null;
  match: Matcher;
}

export interface Span {
  start: number;
  end: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: Category;
  title: string;
  explanation: string;
  citation: string | null;
  page: number;
  paragraphIndex: number;
  snippet: string;
  span: Span;
  confidence: number;
  negated: boolean;
  rulePackVersion: string;
}

export interface RuleMatch {
  paragraphIndex: number;
  span: Span;
  snippet: string;
  confidence: number;
}
