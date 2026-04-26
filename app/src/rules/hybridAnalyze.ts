// Wave 21 Part A — Phase 18 hybrid analyze() wrapper.
//
// Contract:
//   - The deterministic rules engine (analyze) is the authority. It
//     always runs; the classifier never removes or overrides its
//     findings.
//   - When the feature flag is off OR no embedFn is supplied, the
//     hybrid path returns analyze()'s output verbatim. Default off.
//   - When enabled, paragraphs that produced ZERO deterministic
//     findings get a second pass. For each rule whose title shares
//     at least one keyword with the paragraph (cheap pre-filter),
//     compute cosine similarity between paragraph and rule title
//     embeddings and emit a Finding when similarity >= threshold.
//   - Hybrid findings carry confidence = 0.5 (visibly "soft") so
//     downstream consumers can distinguish them from regex/proximity
//     hits. They use the rule's existing severity/category/title.
//   - maxLlmCalls caps total embedding calls per lease so a worst-
//     case parse can't fan out unboundedly. Default 50.

import type { LeaseDocument } from '../parser/types';
import { analyze, RULE_PACK_VERSION } from './analyze';
import type { Finding, Rule } from './types';
import type { CompiledRule } from './compileRules';

export interface EmbedFunction {
  (texts: string[]): Promise<Float32Array[]>;
}

export interface HybridAnalyzeAuditEntry {
  kind: string;
  payload: Record<string, unknown>;
}

export interface HybridAnalyzeOptions {
  doc: LeaseDocument;
  rules: Rule[] | CompiledRule[];
  enabled: boolean;
  embedFn: EmbedFunction | null;
  threshold?: number;
  maxLlmCalls?: number;
  /**
   * Optional audit callback. When supplied, fires one
   * `kind: 'llm-classify'` entry per hybrid finding emitted, with a
   * `{ ruleId, paragraphIndex, modelId, similarity }` payload. Wave 23
   * will pass `safeAudit` here when it wires the real model. No-op
   * if the flag is off or the classifier emits zero hybrid findings.
   */
  audit?: (entry: HybridAnalyzeAuditEntry) => Promise<void> | void;
  /**
   * Identifies the model that produced the embeddings — used in audit
   * payloads. Defaults to `'unknown'` so callers without a real model
   * can still ship attestation entries with sane shape.
   */
  modelId?: string;
}

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_MAX_LLM_CALLS = 50;

/**
 * Run the deterministic engine, then optionally augment with a
 * classifier pass. See module header for the contract.
 */
export async function runHybridAnalyze(opts: HybridAnalyzeOptions): Promise<Finding[]> {
  const { doc, rules, enabled, embedFn } = opts;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const maxLlmCalls = opts.maxLlmCalls ?? DEFAULT_MAX_LLM_CALLS;
  const audit = opts.audit;
  const modelId = opts.modelId ?? 'unknown';

  const baseFindings = analyze(doc, rules);

  if (!enabled || embedFn === null || maxLlmCalls <= 0) return baseFindings;

  // Index of paragraphs that already have at least one finding —
  // these are skipped on the classifier pass.
  const flagged = new Set<number>();
  for (const f of baseFindings) flagged.add(f.paragraphIndex);

  // Pre-compute keyword sets for each rule (lowercased word set from
  // rule title). Rule title is the cheapest "anchor" we have without
  // synthesizing prompts.
  const rulesArr = rules as Rule[];
  const ruleKeywords = rulesArr.map((r) => {
    const tokens = r.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4);
    return new Set(tokens);
  });

  // Build the work queue: (paragraphIndex, ruleIndex) pairs where the
  // paragraph has zero findings AND shares at least one keyword with
  // the rule title. Bounded by maxLlmCalls.
  type Work = { pIdx: number; rIdx: number };
  const work: Work[] = [];
  for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
    if (flagged.has(pIdx)) continue;
    const para = doc.paragraphs[pIdx];
    if (!para) continue;
    const lower = para.text.toLowerCase();
    for (let rIdx = 0; rIdx < rulesArr.length; rIdx++) {
      const kws = ruleKeywords[rIdx];
      if (!kws || kws.size === 0) continue;
      let overlaps = false;
      for (const kw of kws) {
        if (lower.includes(kw)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) work.push({ pIdx, rIdx });
      if (work.length >= maxLlmCalls) break;
    }
    if (work.length >= maxLlmCalls) break;
  }

  if (work.length === 0) return baseFindings;

  // Embed paragraphs and rule titles in two batched calls. De-dupe.
  const paraIdxs = Array.from(new Set(work.map((w) => w.pIdx)));
  const ruleIdxs = Array.from(new Set(work.map((w) => w.rIdx)));
  const paraTexts = paraIdxs.map((i) => doc.paragraphs[i]?.text ?? '');
  const ruleTexts = ruleIdxs.map((i) => rulesArr[i]?.title ?? '');

  const [paraVecs, ruleVecs] = await Promise.all([embedFn(paraTexts), embedFn(ruleTexts)]);

  const paraVecByIdx = new Map<number, Float32Array>();
  paraIdxs.forEach((i, k) => {
    const v = paraVecs[k];
    if (v) paraVecByIdx.set(i, v);
  });
  const ruleVecByIdx = new Map<number, Float32Array>();
  ruleIdxs.forEach((i, k) => {
    const v = ruleVecs[k];
    if (v) ruleVecByIdx.set(i, v);
  });

  const extras: Finding[] = [];
  for (const w of work) {
    const pv = paraVecByIdx.get(w.pIdx);
    const rv = ruleVecByIdx.get(w.rIdx);
    if (!pv || !rv) continue;
    const sim = cosine(pv, rv);
    if (sim < threshold) continue;
    const rule = rulesArr[w.rIdx];
    const para = doc.paragraphs[w.pIdx];
    if (!rule || !para) continue;
    extras.push({
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      title: rule.title,
      explanation: rule.plainEnglish ?? rule.title,
      citation: rule.citation,
      page: para.page,
      paragraphIndex: w.pIdx,
      snippet: para.text.slice(0, 200),
      span: { start: 0, end: Math.min(para.text.length, 200) },
      confidence: 0.5,
      negated: false,
      rulePackVersion: RULE_PACK_VERSION,
      evidence: { modelId, similarity: sim },
    });
    if (audit) {
      // Fire-and-await one attestation per hybrid finding. Errors in
      // the audit callback do NOT abort the analyze pipeline (the
      // safeAudit pattern is the caller's responsibility — see
      // App.tsx's safeAudit wrapper for the production version).
      await audit({
        kind: 'llm-classify',
        payload: {
          ruleId: rule.id,
          paragraphIndex: w.pIdx,
          modelId,
          similarity: sim,
        },
      });
    }
  }

  return [...baseFindings, ...extras];
}

function cosine(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
