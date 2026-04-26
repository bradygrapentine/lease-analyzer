import { describe, it, expect, vi } from 'vitest';
import { runClassifierPass, runHybridAnalyze, type EmbedFunction } from './hybridAnalyze';
import type { LeaseDocument } from '../parser/types';
import type { Rule } from './types';

function doc(paragraphs: string[]): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: paragraphs.map((text) => ({ text, page: 1 })),
    sections: [],
    raw: paragraphs.join('\n\n'),
  };
}

function rule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    title: 'Auto-renewal clause',
    severity: 'medium',
    category: 'general',
    explanation: 'A rule about renewal',
    citation: null,
    match: { type: 'regex', pattern: 'auto[- ]?renew' },
    ...over,
  } as Rule;
}

/**
 * Stub embedder: maps each input string to a deterministic vector
 * derived from the string, so we can reason about similarity in tests
 * without booting a real model.
 *
 *   - Strings sharing a common keyword have overlapping non-zero
 *     dimensions (high similarity).
 *   - Disjoint strings produce orthogonal vectors (similarity ~ 0).
 */
function makeStubEmbedder(): EmbedFunction {
  // Each unique 4+-char word becomes a dimension. Vector is the
  // L2-normalized count of those words in the input.
  const dimByWord = new Map<string, number>();
  function dimOf(w: string): number {
    let d = dimByWord.get(w);
    if (d === undefined) {
      d = dimByWord.size;
      dimByWord.set(w, d);
    }
    return d;
  }
  return async (texts: string[]) => {
    return texts.map((t) => {
      const counts = new Map<number, number>();
      for (const w of t
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4)) {
        counts.set(dimOf(w), (counts.get(dimOf(w)) ?? 0) + 1);
      }
      const dim = dimByWord.size + 32; // pad
      const vec = new Float32Array(dim);
      let n = 0;
      for (const [d, c] of counts) {
        vec[d] = c;
        n += c * c;
      }
      const norm = Math.sqrt(n) || 1;
      for (let i = 0; i < vec.length; i++) vec[i] = (vec[i] ?? 0) / norm;
      return vec;
    });
  };
}

describe('runHybridAnalyze', () => {
  it('flag off: returns analyze() output verbatim, no embedFn calls', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const findings = await runHybridAnalyze({
      doc: doc(['This lease shall auto-renew annually.', 'Another paragraph.']),
      rules: [rule()],
      enabled: false,
      embedFn,
    });
    expect(findings).toHaveLength(1); // regex catches auto-renew
    expect(findings[0]?.confidence).toBeCloseTo(0.9, 1);
    expect(embedFn).not.toHaveBeenCalled();
  });

  it('flag on but embedFn null: returns analyze() output verbatim', async () => {
    const findings = await runHybridAnalyze({
      doc: doc(['This lease shall auto-renew annually.']),
      rules: [rule()],
      enabled: true,
      embedFn: null,
    });
    expect(findings).toHaveLength(1);
  });

  it('flag on + stub embedder: adds a soft finding when keyword overlaps and similarity is high', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    // Paragraph 0: matches the regex (auto-renew). Paragraph 1: doesn't,
    // but shares the word "renewal" with the rule title.
    const findings = await runHybridAnalyze({
      doc: doc([
        'This lease shall auto-renew annually.',
        'The renewal clause grants additional renewal terms upon notice.',
      ]),
      rules: [rule()],
      enabled: true,
      embedFn,
      threshold: 0.3,
    });
    expect(embedFn).toHaveBeenCalled();
    // 1 deterministic + 1 hybrid (paragraph 1).
    expect(findings).toHaveLength(2);
    const hybrid = findings.find((f) => f.confidence === 0.5);
    expect(hybrid).toBeDefined();
    expect(hybrid?.paragraphIndex).toBe(1);
    expect(hybrid?.ruleId).toBe('r1');
  });

  it('flag on + stub embedder: similarity below threshold → no extra finding', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    // Paragraph contains the bare keyword "renewal" but is otherwise
    // disjoint; with a 0.99 threshold, the hybrid pass should NOT fire.
    const findings = await runHybridAnalyze({
      doc: doc(['Renewal of insurance is the tenant responsibility.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      threshold: 0.99,
    });
    expect(findings).toHaveLength(0);
    expect(embedFn).toHaveBeenCalled();
  });

  it('hybrid never removes a deterministic finding', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const findings = await runHybridAnalyze({
      doc: doc(['This lease shall auto-renew annually.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      threshold: 0.3,
    });
    // Paragraph 0 already has a deterministic hit; the hybrid pass
    // skips paragraphs with at least one finding. Result is 1, not 2.
    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBeCloseTo(0.9, 1);
  });

  it('maxLlmCalls=0 prevents any embedder calls even when enabled', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const findings = await runHybridAnalyze({
      doc: doc(['Renewal text here.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      maxLlmCalls: 0,
    });
    expect(embedFn).not.toHaveBeenCalled();
    expect(findings).toHaveLength(0);
  });

  it('fires one llm-classify audit entry per hybrid finding when audit is supplied', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const audit = vi.fn<[{ kind: string; payload: Record<string, unknown> }], Promise<void>>(
      async () => undefined,
    );
    const findings = await runHybridAnalyze({
      doc: doc(['The renewal clause grants additional renewal terms upon notice.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      audit,
      modelId: 'Xenova/test-model',
      threshold: 0.3,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe(0.5);
    expect(audit).toHaveBeenCalledTimes(1);
    const payload = audit.mock.calls[0]?.[0];
    expect(payload?.kind).toBe('llm-classify');
    expect(payload?.payload).toMatchObject({
      ruleId: 'r1',
      paragraphIndex: 0,
      modelId: 'Xenova/test-model',
    });
    expect(typeof (payload?.payload as { similarity?: unknown }).similarity).toBe('number');
  });

  it('does not fire any audit entries when the flag is off', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const audit = vi.fn<[{ kind: string; payload: Record<string, unknown> }], Promise<void>>(
      async () => undefined,
    );
    await runHybridAnalyze({
      doc: doc(['Renewal text here.']),
      rules: [rule()],
      enabled: false,
      embedFn,
      audit,
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it('does not fire any audit entries when zero hybrid findings are emitted', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const audit = vi.fn<[{ kind: string; payload: Record<string, unknown> }], Promise<void>>(
      async () => undefined,
    );
    await runHybridAnalyze({
      doc: doc(['Renewal text but with very high threshold.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      audit,
      threshold: 0.99,
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it('audit payload defaults modelId to "unknown" when not supplied', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const audit = vi.fn<[{ kind: string; payload: Record<string, unknown> }], Promise<void>>(
      async () => undefined,
    );
    await runHybridAnalyze({
      doc: doc(['The renewal clause grants additional renewal terms upon notice.']),
      rules: [rule()],
      enabled: true,
      embedFn,
      audit,
      threshold: 0.3,
    });
    const payload = audit.mock.calls[0]?.[0]?.payload as { modelId?: string };
    expect(payload?.modelId).toBe('unknown');
  });

  it('hybrid findings carry evidence: { modelId, similarity }; deterministic findings do not', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const findings = await runHybridAnalyze({
      doc: doc([
        'This lease shall auto-renew annually.',
        'The renewal clause grants additional renewal terms upon notice.',
      ]),
      rules: [rule()],
      enabled: true,
      embedFn,
      modelId: 'Xenova/test-model',
      threshold: 0.3,
    });
    expect(findings).toHaveLength(2);
    const deterministic = findings.find((f) => f.confidence >= 0.7);
    const hybrid = findings.find((f) => f.confidence === 0.5);
    expect(deterministic?.evidence).toBeUndefined();
    expect(hybrid?.evidence).toEqual({
      modelId: 'Xenova/test-model',
      similarity: expect.any(Number),
    });
  });

  it('cosine returns 0 for zero-length vectors (no extra finding emitted)', async () => {
    const zeroEmbedder: EmbedFunction = async (texts) => texts.map(() => new Float32Array(0));
    const findings = await runHybridAnalyze({
      doc: doc(['Renewal text here.']),
      rules: [rule()],
      enabled: true,
      embedFn: zeroEmbedder,
      threshold: 0.0001,
    });
    // Empty vectors → similarity 0 < threshold → no extra finding.
    expect(findings).toHaveLength(0);
  });

  it('cosine returns 0 for all-zero vectors (no extra finding emitted)', async () => {
    const zeroEmbedder: EmbedFunction = async (texts) =>
      texts.map(() => new Float32Array([0, 0, 0]));
    const findings = await runHybridAnalyze({
      doc: doc(['Renewal text here.']),
      rules: [rule()],
      enabled: true,
      embedFn: zeroEmbedder,
      threshold: 0.0001,
    });
    expect(findings).toHaveLength(0);
  });

  // Wave 24-A: runClassifierPass is the standalone classifier pass that
  // the upload-path now calls after the Web Worker returns deterministic
  // findings. It must return ONLY the delta (extras) and never re-emit
  // findings against paragraphs already covered by `baseFindings`.
  it('runClassifierPass: returns delta only when given pre-computed baseFindings', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const d = doc(['The renewal clause grants additional renewal terms upon notice.']);
    const extras = await runClassifierPass({
      doc: d,
      rules: [rule()],
      baseFindings: [], // no deterministic findings yet
      embedFn,
      threshold: 0.3,
    });
    expect(extras).toHaveLength(1);
    expect(extras[0]?.confidence).toBe(0.5);
    expect(extras[0]?.paragraphIndex).toBe(0);
  });

  it('runClassifierPass: never duplicates findings against paragraphs already covered by baseFindings', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const d = doc(['The renewal clause grants additional renewal terms upon notice.']);
    // Pre-seed a deterministic finding on paragraph 0 — the classifier
    // pass must skip it.
    const extras = await runClassifierPass({
      doc: d,
      rules: [rule()],
      baseFindings: [
        {
          ruleId: 'r1',
          severity: 'medium',
          category: 'general',
          title: 'Auto-renewal clause',
          explanation: 'preset',
          citation: null,
          page: 1,
          paragraphIndex: 0,
          snippet: '',
          span: { start: 0, end: 0 },
          confidence: 0.9,
          negated: false,
          rulePackVersion: '1',
        },
      ],
      embedFn,
      threshold: 0.3,
    });
    expect(extras).toEqual([]);
  });

  it('skips rules whose title has no 4+-char tokens (cheap pre-filter is empty)', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    const shortTitle = rule({ title: 'A B C' });
    const findings = await runHybridAnalyze({
      doc: doc(['No renewal here.']),
      rules: [shortTitle],
      enabled: true,
      embedFn,
    });
    expect(findings).toEqual([]);
    expect(embedFn).not.toHaveBeenCalled();
  });

  // Wave 29 Part B (Phase 2): rules may declare `hybridAnchors`,
  // additional substrings merged into the keyword pre-filter so a
  // paragraph that doesn't share any title tokens can still qualify
  // for the embedding pass when it contains a known anchor phrase.
  it('hybridAnchors merge into pre-filter so an off-title paragraph qualifies', async () => {
    const embedFn = vi.fn(makeStubEmbedder());
    // Title-only tokens are {indemnification, landlord} — the test
    // paragraph contains neither, but it does contain the anchor
    // phrase "hold harmless". Without anchors the rule would be
    // skipped; with anchors it should produce a hybrid finding.
    const r = rule({
      id: 'indemnification',
      title: 'Indemnification of landlord',
      match: { type: 'keywordProximity', keywords: ['xxxx', 'yyyy'], window: 40 },
      hybridAnchors: ['hold harmless'],
    });
    const paragraphText =
      'Tenant agrees to hold harmless the property owner from any third-party claims arising on the premises.';
    const findings = await runHybridAnalyze({
      doc: doc([paragraphText]),
      rules: [r],
      enabled: true,
      embedFn,
      threshold: 0.0,
    });
    expect(embedFn).toHaveBeenCalled();
    expect(findings.length).toBe(1);
    expect(findings[0]?.ruleId).toBe('indemnification');
    expect(findings[0]?.confidence).toBe(0.5);

    // Sanity: same paragraph + same rule WITHOUT anchors → no
    // pre-filter overlap, no embed call, no finding.
    const embedFn2 = vi.fn(makeStubEmbedder());
    const rNoAnchors = rule({
      id: 'indemnification',
      title: 'Indemnification of landlord',
      match: { type: 'keywordProximity', keywords: ['xxxx', 'yyyy'], window: 40 },
    });
    const findings2 = await runHybridAnalyze({
      doc: doc([paragraphText]),
      rules: [rNoAnchors],
      enabled: true,
      embedFn: embedFn2,
      threshold: 0.0,
    });
    expect(embedFn2).not.toHaveBeenCalled();
    expect(findings2).toEqual([]);
  });
});
