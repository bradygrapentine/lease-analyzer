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
  /**
   * Optional ISO-like jurisdiction codes (e.g. `"US-CA"`, `"UK-ENG"`). If
   * omitted or empty, the rule applies everywhere. Phase 10b addition —
   * purely additive so existing packs deserialize unchanged.
   */
  jurisdictions?: string[];
  /**
   * Optional plain-English summary shown to end-users under the existing
   * explanation ("What this means"). Should be 1-2 sentences, no legalese,
   * no judgmental language. Max ~500 chars (enforced by pack schema).
   * Phase 14 addition — purely additive.
   */
  plainEnglish?: string;
  /**
   * Optional safe, neutral suggested replacement clause (one paragraph).
   * Consumed by the counter-offer library to pre-populate edits. Phase 14
   * addition — purely additive.
   */
  suggestedEdit?: string;
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
  /**
   * Wave 8 Part B — when set, this finding's underlying rule body has
   * drifted from the signed baseline that was last verified. UI surfaces
   * a "deviates from verified pack" badge. Optional + additive so all
   * existing finding consumers keep working unchanged.
   */
  deviation?: { fromFingerprint: string };
  /**
   * Wave 23 Part C — Phase 18 hybrid attestation. Set on findings
   * emitted by the on-device classifier pass (confidence 0.5);
   * absent on deterministic regex/proximity findings. Mirrors the
   * Wave 22-A `'llm-classify'` audit-log payload so consumers that
   * don't have access to the audit log can still display the LLM
   * provenance (future UI badge, JSON export attestation).
   */
  evidence?: { modelId: string; similarity: number };
}

export interface RuleMatch {
  paragraphIndex: number;
  span: Span;
  snippet: string;
  confidence: number;
}
