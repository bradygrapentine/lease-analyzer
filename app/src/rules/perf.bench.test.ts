import { describe, expect, it } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { makePdf, type PdfFixturePage } from '../parser/testFixtures';
import { analyze } from './analyze';
import { compileRules } from './compileRules';
import { RULE_PACK_V1 } from './packV1';

// Phase 13 scaled perf budget: `parseLease` + `analyze` × N iterations
// over a synthetic lease. The existing 50-page bench (in the parser
// directory) guards the parser alone; this file guards the whole
// parse + rule-engine pipeline with the pre-compiled rule cache
// hot, at a much larger page count.
//
// Target was 200 pages / 8 s, but Vitest runs test *files* in parallel
// (jsdom pool, 4 workers by default) and the 200-page parse adds ~1.2 s
// of solo CPU per worker — enough to destabilise the concurrent jsdom +
// fake-indexeddb tests (observed: ~1-in-5 flaky timeouts in `listLeases`
// under `test:coverage`). We fall back to 100 pages / 4 s (prorated,
// same ~40 ms/page ceiling) which still exercises the compiled-rule
// cache across three iterations while halving CPU contention.
// Restore `PAGES = 200` whenever the fake-indexeddb transaction race in
// `App.panels.test.tsx` / `App.test.tsx` is addressed upstream.
const PAGES = 100;
const ITERATIONS = 3;
const TOTAL_BUDGET_MS = 4000;

function pageFor(n: number): PdfFixturePage {
  const yStart = 72;
  const lineHeight = 16;
  // Mix of clauses that exercise keywordProximity, regex, and
  // sectionAnchored matchers in RULE_PACK_V1 so the cache gets hit
  // across every matcher type. Each line carries the page number as
  // a prefix so `stripHeadersAndFooters` (which deletes any line that
  // repeats verbatim on 3+ pages) doesn't eat the rule-bearing body.
  const lines = [
    `Section ${n}. Agreement`,
    `${n}. Tenant shall pay rent on the first of each month.`,
    `${n}. A late fee of $50 applies after five days.`,
    `${n}. Tenant shall indemnify landlord against all claims.`,
    `${n}. This lease shall auto-renew unless cancelled in writing.`,
    `${n}. The prevailing party may recover attorney fees.`,
    `${n}. All disputes go to binding arbitration.`,
    `${n}. Tenant waives any right to a jury trial.`,
    `${n}. Tenant may not sublet without landlord consent.`,
    `${n}. Base rent shall escalate annually by three percent.`,
    `${n}. Early termination requires sixty days written notice.`,
  ];
  return {
    blocks: lines.map((text, i) => ({ text, x: 72, y: yStart + i * lineHeight })),
  };
}

describe('analyze perf budget', () => {
  it(`parses + analyzes a ${PAGES}-page lease ${ITERATIONS}x under ${TOTAL_BUDGET_MS}ms`, async () => {
    const pages = Array.from({ length: PAGES }, (_, i) => pageFor(i + 1));
    const bytes = await makePdf(pages);

    // Compile once; re-use across every analyze() call — the whole point
    // of Phase 13 is that repeated analyses skip the RegExp / keyword
    // lowercase allocations.
    const compiled = compileRules(RULE_PACK_V1);

    const totalStart = performance.now();
    const parseStart = performance.now();
    const doc = await parseLease(bytes);
    const parseMs = performance.now() - parseStart;

    const analyzeTimings: number[] = [];
    let lastFindings = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
      const t0 = performance.now();
      const findings = analyze(doc, compiled);
      analyzeTimings.push(performance.now() - t0);
      lastFindings = findings.length;
    }
    const totalMs = performance.now() - totalStart;

    // Verbose logging for local `vitest --reporter verbose` — does not
    // affect assertions but gives a quick comparison of before/after.
    console.log(
      `[perf] pages=${PAGES} parse=${parseMs.toFixed(1)}ms analyze(x${ITERATIONS})=` +
        analyzeTimings.map((t) => t.toFixed(1)).join(',') +
        `ms total=${totalMs.toFixed(1)}ms findings=${lastFindings}`,
    );

    expect(doc.pages).toHaveLength(PAGES);
    expect(doc.paragraphs.length).toBeGreaterThan(0);
    expect(lastFindings).toBeGreaterThan(0);
    expect(totalMs).toBeLessThan(TOTAL_BUDGET_MS);
  }, 60_000);
});
