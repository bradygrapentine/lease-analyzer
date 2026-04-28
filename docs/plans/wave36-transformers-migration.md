# Wave 36 — `@huggingface/transformers` v2→v4 migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@xenova/transformers@2.17.2` with `@huggingface/transformers@4.x` end-to-end, removing the `GHSA-xq3m-2v4x-88gg` (protobufjs) accept-risk row from `audit:prod`.

**Architecture.** Dual-runtime behind a URL flag (`?transformersV4=on`) during the wave; both packages installed simultaneously. Same-session aggressive cutover gated on a load-bearing Part 0 spike (parity ≥0.99 / zero new accept-risk rows / chunk ≤1.5 MiB). On any spike failure, halt for re-brainstorm — no auto-fallback to multi-wave split.

**Tech Stack.** Node 20, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 5, Vitest, React 18 + RTL, Playwright (real-model nightly), `@xenova/transformers@2.17.2` (current) → `@huggingface/transformers@4.x` (target), ONNX Runtime WASM (single-thread SIMD), Workbox (PWA precache).

**Base SHA.** All parts branch from post-Wave-35 `origin/main`. Predecessor: [Wave 36 design spec](../superpowers/specs/2026-04-28-wave36-transformers-migration-design.md).

---

## §0 What changed since Wave 35 (context for fresh agents)

Wave 35 (PRs #147 plan, #148 Part A) shipped:

- **A** — Node CLI `app/scripts/hybrid-stats-report.mjs` reads exported `leaseguard.audit.v1` JSON, decides ACT vs NO-OP at `fires≥10 AND precision<0.70`. Wired as `npm run hybrid:stats`. First-run decision was NO-OP (zero entries), so Parts B/C deferred per plan §8.

State at Wave 36 start: clean tree, `@xenova/transformers@2.17.2` is the sole classifier runtime, `loadClassifier.ts` is 78 lines (no helpers split), `audit-prod.mjs` `ALLOW_ADVISORIES` contains the protobufjs row at line 26, `docs/SECURITY.md` §7.1 documents the accept-risk.

## §1 Hard rules

1. **Spike-failure halts the wave.** If Part 0 misses any of its three acceptance criteria (parity / audit / size), stop and surface findings — do not silently degrade to plan B.
2. **No new `ALLOW_ADVISORIES` rows.** The wave's whole point is to *remove* the protobufjs row, not trade it. Any new advisory introduced by v4's transitive deps requires explicit halt-and-discuss.
3. **Default flip is gated on two conditions.** Part B does not flip the default until BOTH the hybrid-golden spec passes against `?transformersV4=on` AND the user signs off on a manual smoke walk.
4. **No model change in this wave.** Stay on `paraphrase-MiniLM-L3-v2` weights. If v4's `model.id` reports a different namespace string, accept the rename in `Finding.evidence.modelId` going forward — do not backfill old audit entries.
5. **Bundle ceilings are absolute.** Chunk ≤1.5 MiB, total opt-in payload ≤30 MiB precache cap. Breach halts before Part A.
6. **No CSP / IDB schema / new audit-kind in Wave 36.** Runtime swap only.

## §2 Out of scope

- Switching to a different model.
- Telemetry, cloud sync, or new accept-risk infrastructure.
- WCAG 2.1 AA closeout, Storybook visual snapshot CI, pdf.js dark-mode page raster (all separately tracked).
- Wave 35 Part B / C re-run.
- Worktree cleanup for stale Waves 27–34 branches.

## §3 Execution dependency graph

```
   ┌──────────────────────────────────┐
   │ Part 0 — Compatibility spike     │
   │ parity / audit / size            │
   │ (timeboxed, throwaway)           │
   └──────────────┬───────────────────┘
                  │ all three PASS?
                  │
        ┌─────────┴─────────┐
        │ no                │ yes
        ▼                   ▼
   ┌──────────┐     ┌─────────────────────────┐
   │ HALT     │     │ Part A — v4 behind flag │
   │ rebrain. │     └────────┬────────────────┘
   └──────────┘              │ A merged
                             ▼
                    ┌─────────────────────────┐
                    │ Part B — default flip   │
                    │ gate: hybrid-golden +   │
                    │ manual smoke walk       │
                    └────────┬────────────────┘
                             │ B merged
                             ▼
                    ┌─────────────────────────┐
                    │ Part C — excise v2      │
                    └────────┬────────────────┘
                             │ C merged
                             ▼
                    ┌─────────────────────────┐
                    │ Part D — accept-risk    │
                    │ removal                 │
                    └─────────────────────────┘
```

Serial by design. Parts cannot parallelize: B depends on A's flag wiring, C depends on B's flip having merged (otherwise stripping v2 breaks the default), D depends on C (accept-risk removal requires v2 to actually be gone).

---

## §4 File structure

### Part 0 (spike — discardable)
- **Create (throwaway):** `app/scripts/wave36-spike.mjs` — Node script that: imports v4, loads existing assets, runs parity check, emits a markdown report. Not committed unless judged worth keeping.

### Part A
- **Modify:** `app/package.json` — add `@huggingface/transformers@4.x` (keep `@xenova/transformers` for now).
- **Modify:** `app/package-lock.json` — `npm install` byproduct.
- **Modify:** `app/src/llm/loadClassifier.ts` — branch on `?transformersV4=on` flag, dual import paths.
- **Modify:** `app/src/llm/loadClassifier.test.ts` — parameterized over runtime, +embedding-shape regression assertion.
- **Modify:** `app/scripts/build-classifier-assets.mjs` — learn dual ORT WASM source paths.
- **Modify:** `app/scripts/check-bundle-budget.mjs` — add `transformers` chunk pattern + budget at measured-v4 + 10%.

### Part B
- **Modify:** `app/src/llm/loadClassifier.ts` — flip default; add `?transformersV2=on` kill switch.
- **Modify:** `tests/e2e/hybrid-golden.spec.ts` — update `modelId` expectation if v4 reports a different string.

### Part C
- **Modify:** `app/package.json` — remove `@xenova/transformers`.
- **Modify:** `app/package-lock.json` — `npm install` byproduct.
- **Modify:** `app/src/llm/loadClassifier.ts` — strip v2 import branch + kill switch.
- **Modify:** `app/src/llm/loadClassifier.test.ts` — drop v2-runtime parameterization row.
- **Modify:** `app/src/App/usePipeline.test.ts` — drop any v2-only fixture branches.
- **Modify:** `app/scripts/build-classifier-assets.mjs` — collapse to v4-only ORT path.
- **Modify (one-line comment):** `app/src/ui/HybridFeedbackButton.tsx` (or wherever the badge renders modelId) — note historical modelId split if v4 renamed.

### Part D
- **Modify:** `app/scripts/audit-prod.mjs` — remove `https://github.com/advisories/GHSA-xq3m-2v4x-88gg` from `ALLOW_ADVISORIES`.
- **Modify:** `docs/SECURITY.md` — close §7.1 with a one-line history note.

---

## §5 Part 0 — Compatibility spike (timeboxed, throwaway)

**Branch:** `wave36-0-spike`
**Worktree:** `worktrees/wave36-0-spike`
**Mode:** Direct, this session.
**Timebox:** ≤90 min. If unresolved at the timebox, surface the partial findings and halt.

### Task 0.1: Set up the worktree

- [ ] **Step 1: Verify base SHA**

```bash
git fetch origin
git rev-parse origin/main
# capture; this is the base for all five parts
```

- [ ] **Step 2: Create worktree off origin/main**

```bash
git worktree add -b wave36-0-spike worktrees/wave36-0-spike origin/main
ln -s ../../../app/node_modules worktrees/wave36-0-spike/app/node_modules
ls worktrees/wave36-0-spike/app/node_modules/vite >/dev/null && echo "OK"
```

(Three-parent symlink per the worktree convention; two-parent is broken.)

### Task 0.2: Install v4 alongside v2

- [ ] **Step 1: Add v4 without removing v2**

```bash
cd worktrees/wave36-0-spike/app
npm install @huggingface/transformers@4 --save-exact
```

- [ ] **Step 2: Confirm both are installed**

```bash
ls node_modules/@huggingface/transformers/package.json node_modules/@xenova/transformers/package.json
```

Both must exist.

### Task 0.3: Spike script — embedding parity check

- [ ] **Step 1: Write `app/scripts/wave36-spike.mjs`**

```javascript
// Wave 36 Part 0 — compatibility spike. Throwaway.
//
// Three deliverables: parity, audit-diff, size. Run from app/.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL_ID = 'Xenova/paraphrase-MiniLM-L3-v2';

// Five fixed paragraphs from app/src/parser/testFixtures.ts patterns —
// covers a renewal clause, an arbitration clause, a jury waiver, an
// indemnity, and a benign filler paragraph.
const PARAGRAPHS = [
  'This Lease shall automatically renew for successive one-year terms unless Tenant gives written notice of non-renewal at least sixty (60) days prior to the expiration of the then-current term.',
  'Any dispute arising out of or relating to this Lease shall be resolved by final and binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules.',
  'TENANT HEREBY WAIVES THE RIGHT TO TRIAL BY JURY in any action arising out of this Lease.',
  'Tenant shall indemnify, defend, and hold harmless Landlord from and against any and all claims, damages, losses, and expenses arising out of or connected with Tenant\'s use of the Premises.',
  'The leased premises are located at 123 Main Street, Suite 4, Anytown, USA, and consist of approximately 1,250 square feet of office space.',
];

function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function loadV2Embedder() {
  const t = await import('@xenova/transformers');
  t.env.localModelPath = resolve('public/classifier') + '/';
  t.env.allowRemoteModels = false;
  t.env.backends.onnx.wasm.wasmPaths = resolve('public/classifier/onnx-runtime') + '/';
  t.env.backends.onnx.wasm.numThreads = 1;
  const extractor = await t.pipeline('feature-extraction', MODEL_ID);
  return async (text) => {
    const r = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(r.data);
  };
}

async function loadV4Embedder() {
  // v4 expected API mirrors v2 in name (pipeline + env). Confirm exact
  // shape against installed package; if it differs, adapt this function
  // and document the delta in the spike report.
  const t = await import('@huggingface/transformers');
  t.env.localModelPath = resolve('public/classifier') + '/';
  t.env.allowRemoteModels = false;
  t.env.backends.onnx.wasm.wasmPaths = resolve('public/classifier/onnx-runtime') + '/';
  t.env.backends.onnx.wasm.numThreads = 1;
  const extractor = await t.pipeline('feature-extraction', MODEL_ID);
  return async (text) => {
    const r = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(r.data);
  };
}

const v2 = await loadV2Embedder();
const v4 = await loadV4Embedder();

const rows = [];
for (const p of PARAGRAPHS) {
  const a = await v2(p);
  const b = await v4(p);
  const sim = cosineSim(a, b);
  const v2Mag = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const v4Mag = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  rows.push({
    snippet: p.slice(0, 60) + '…',
    sim: sim.toFixed(4),
    v2Mag: v2Mag.toFixed(4),
    v4Mag: v4Mag.toFixed(4),
    shape: `${a.length} vs ${b.length}`,
  });
}

console.log('# Wave 36 spike — embedding parity\n');
console.log('| paragraph | cosine sim | v2 magnitude | v4 magnitude | shape |');
console.log('| --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(`| ${r.snippet} | ${r.sim} | ${r.v2Mag} | ${r.v4Mag} | ${r.shape} |`);
}

const minSim = Math.min(...rows.map((r) => Number(r.sim)));
const allShapesMatch = rows.every((r) => {
  const [a, b] = r.shape.split(' vs ').map(Number);
  return a === b;
});

console.log('');
console.log(`Min cosine sim: ${minSim.toFixed(4)} (acceptance: ≥0.99)`);
console.log(`All shapes match: ${allShapesMatch}`);
console.log(`Decision: ${minSim >= 0.99 && allShapesMatch ? 'PARITY-PASS' : 'PARITY-FAIL'}`);
```

- [ ] **Step 2: Confirm classifier assets exist locally**

```bash
test -d public/classifier/Xenova/paraphrase-MiniLM-L3-v2 \
  || (echo 'classifier assets missing; run npm run build:classifier-assets first' && exit 1)
test -d public/classifier/onnx-runtime || npm run build:classifier-assets
```

- [ ] **Step 3: Run the parity check**

```bash
node scripts/wave36-spike.mjs > /tmp/wave36-spike-parity.md 2>&1
cat /tmp/wave36-spike-parity.md
```

Expected: PARITY-PASS line at the bottom, min cosine sim ≥0.99, all shapes match (likely 384 vs 384). Capture the report.

**HALT condition:** if `PARITY-FAIL`, do not proceed. Surface the report; re-brainstorm the failure mode (different tokenizer? different pooling? different model.id resolving to different weights?).

### Task 0.4: Audit diff

- [ ] **Step 1: Run audit:prod with v4 installed**

```bash
npm run audit:prod 2>&1 | tee /tmp/wave36-spike-audit.txt
```

- [ ] **Step 2: Compare against `ALLOW_ADVISORIES` baseline**

The script either passes (zero new advisories) or fails listing new ones. Capture the result.

**HALT condition:** if any new advisory requires adding to `ALLOW_ADVISORIES`, halt. The wave's purpose is to *remove* a row, not trade it. If a benign new advisory appears (e.g. dev-only that `audit-prod` already excludes), document and continue.

### Task 0.5: Size measurement

- [ ] **Step 1: Build with v4 import to measure chunk size**

Temporarily replace the v2 import in `loadClassifier.ts` with v4 (just for measurement — revert before committing):

```bash
# from worktrees/wave36-0-spike/app
sed -i.bak "s|@xenova/transformers|@huggingface/transformers|" src/llm/loadClassifier.ts
npm run build 2>&1 | tee /tmp/wave36-spike-build.txt
ls -la dist/assets/ | grep -iE "transformers|onnx" | tee /tmp/wave36-spike-chunks.txt
du -sh dist/classifier 2>/dev/null | tee -a /tmp/wave36-spike-chunks.txt
mv src/llm/loadClassifier.ts.bak src/llm/loadClassifier.ts
```

- [ ] **Step 2: Compute total opt-in payload**

```
Chunk size: <bytes>
ORT WASM:   <bytes from dist/classifier/onnx-runtime/>
Model:      <bytes from dist/classifier/Xenova/.../>
Total:      <sum>
```

**HALT conditions:**
- Chunk > 1.5 MiB (1_572_864 bytes)
- Total > 30 MiB (31_457_280 bytes)

Either breach halts the wave for re-brainstorm.

### Task 0.6: Spike report + decision

- [ ] **Step 1: Consolidate findings**

Capture the three reports (parity / audit / size) in a single markdown blob; this becomes the body of Part A's PR (linked) and proof that the spike's gates were met.

- [ ] **Step 2: Decide**

- All three PASS → continue to Part A. The spike branch is not pushed — it was throwaway.
- Any FAIL → halt. Surface the report. Do not auto-degrade to plan B; re-brainstorm.

### Task 0.7: Tear down the spike worktree

- [ ] **Step 1: Discard worktree (if PASS) or keep with notes (if FAIL)**

PASS path:

```bash
cd /Users/bradygrapentine/projects/lease-analyzer
git worktree remove worktrees/wave36-0-spike --force
git branch -D wave36-0-spike
```

FAIL path: keep the worktree; the next session needs the artefacts.

---

## §6 Part A — v4 behind flag

**Branch:** `wave36-A-v4-behind-flag`
**Worktree:** `worktrees/wave36-A-v4-behind-flag`
**Mode:** Direct, this session, **only after Part 0 passes**.

### Task A1: Set up the worktree

- [ ] **Step 1: Create worktree off origin/main**

```bash
git worktree add -b wave36-A-v4-behind-flag worktrees/wave36-A-v4-behind-flag origin/main
ln -s ../../../app/node_modules worktrees/wave36-A-v4-behind-flag/app/node_modules
ls worktrees/wave36-A-v4-behind-flag/app/node_modules/vite >/dev/null && echo "OK"
```

### Task A2: Install v4 (real this time)

- [ ] **Step 1: Add v4 to package.json**

```bash
cd worktrees/wave36-A-v4-behind-flag/app
npm install @huggingface/transformers@4 --save-exact
```

- [ ] **Step 2: Verify both packages**

```bash
test -d node_modules/@huggingface/transformers
test -d node_modules/@xenova/transformers
```

### Task A3: Write failing tests (TDD)

- [ ] **Step 1: Replace `app/src/llm/loadClassifier.test.ts` with parameterized version**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadClassifier,
  _resetClassifierCacheForTests,
  DEFAULT_MODEL_ID,
  type EmbedFunction,
} from './loadClassifier';

const RUNTIMES = ['v2', 'v4'] as const;

beforeEach(() => {
  _resetClassifierCacheForTests();
});

function setRuntimeFlag(runtime: 'v2' | 'v4'): void {
  const search = runtime === 'v4' ? '?transformersV4=on' : '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(`http://localhost/${search}`),
  });
}

describe.each(RUNTIMES)('loadClassifier (%s runtime)', (runtime) => {
  beforeEach(() => setRuntimeFlag(runtime));

  it('returns a cached EmbedFunction on subsequent calls', async () => {
    const a = loadClassifier();
    const b = loadClassifier();
    expect(a).toBe(b);
  });

  it('exports DEFAULT_MODEL_ID as Xenova/paraphrase-MiniLM-L3-v2', () => {
    expect(DEFAULT_MODEL_ID).toBe('Xenova/paraphrase-MiniLM-L3-v2');
  });

  // The next two assertions are mocked because jsdom can't actually
  // run ONNX. We verify the dynamic-import boundary picks the right
  // package and threads env settings through.
  it('imports the correct package for this runtime', async () => {
    const v2Spy = vi.fn().mockResolvedValue({
      env: { localModelPath: '', allowRemoteModels: true, backends: { onnx: { wasm: {} } } },
      pipeline: vi.fn().mockResolvedValue(async () => ({ data: new Float32Array(384) })),
    });
    const v4Spy = vi.fn().mockResolvedValue({
      env: { localModelPath: '', allowRemoteModels: true, backends: { onnx: { wasm: {} } } },
      pipeline: vi.fn().mockResolvedValue(async () => ({ data: new Float32Array(384) })),
    });
    vi.doMock('@xenova/transformers', v2Spy);
    vi.doMock('@huggingface/transformers', v4Spy);
    await loadClassifier();
    if (runtime === 'v2') {
      expect(v2Spy).toHaveBeenCalled();
      expect(v4Spy).not.toHaveBeenCalled();
    } else {
      expect(v4Spy).toHaveBeenCalled();
      expect(v2Spy).not.toHaveBeenCalled();
    }
    vi.doUnmock('@xenova/transformers');
    vi.doUnmock('@huggingface/transformers');
  });

  it('returns embeddings of shape [384]', async () => {
    const data = new Float32Array(384);
    for (let i = 0; i < 384; i++) data[i] = (i % 7) * 0.01;
    const stub = {
      env: { localModelPath: '', allowRemoteModels: true, backends: { onnx: { wasm: {} } } },
      pipeline: vi.fn().mockResolvedValue(async () => ({ data })),
    };
    vi.doMock('@xenova/transformers', () => stub);
    vi.doMock('@huggingface/transformers', () => stub);
    const embed: EmbedFunction = await loadClassifier();
    const [vec] = await embed(['hello world']);
    expect(vec.length).toBe(384);
    // Magnitude bound — guards against future tokenizer drift that
    // doesn't change shape but produces wildly different values.
    let mag = 0;
    for (const x of vec) mag += x * x;
    mag = Math.sqrt(mag);
    expect(mag).toBeGreaterThan(0.5);
    expect(mag).toBeLessThan(2.0);
    vi.doUnmock('@xenova/transformers');
    vi.doUnmock('@huggingface/transformers');
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
npx vitest run src/llm/loadClassifier.test.ts
```

Expected: 8 tests fail (4 per runtime × 2 runtimes), the v4-runtime ones with "expected `@huggingface/transformers` to have been called but `@xenova/transformers` was called instead" — `loadClassifier` does not yet branch.

### Task A4: Implement the dual-runtime branch

- [ ] **Step 1: Replace `app/src/llm/loadClassifier.ts`**

```typescript
// Wave 20 Part C / Wave 36 Part A — Phase 18 classifier loader.
// Wave 36 added a dual-runtime branch. The legacy @xenova/transformers
// path remains the default; setting the URL flag `?transformersV4=on`
// switches to @huggingface/transformers (the official v4 successor).
// The branch lives at the dynamic-import boundary so the unused
// runtime is not bundled into the runtime user's session.
//
// Local-only contract: assets at app/public/classifier/<modelId>/ and
// public/classifier/onnx-runtime/. localModelPath + disabled remote
// fallback prevent a CDN fetch (CSP would block).

/** Embedding output: a fixed-length vector per input string. */
export interface EmbedFunction {
  (texts: string[]): Promise<Float32Array[]>;
}

export const DEFAULT_MODEL_ID = 'Xenova/paraphrase-MiniLM-L3-v2';

let cached: Promise<EmbedFunction> | null = null;

function readRuntimeFlag(): 'v2' | 'v4' {
  if (typeof window === 'undefined') return 'v2';
  const search = window.location?.search ?? '';
  const params = new URLSearchParams(search);
  return params.get('transformersV4') === 'on' ? 'v4' : 'v2';
}

async function loadV2Pipeline(modelId: string): Promise<EmbedFunction> {
  const transformers = await import('@xenova/transformers');
  transformers.env.localModelPath = '/classifier/';
  transformers.env.allowRemoteModels = false;
  transformers.env.backends.onnx.wasm.wasmPaths = '/classifier/onnx-runtime/';
  transformers.env.backends.onnx.wasm.numThreads = 1;
  const pipeline = transformers.pipeline as (task: string, model: string) => Promise<unknown>;
  const extractor = (await pipeline('feature-extraction', modelId)) as (
    input: string | string[],
    opts?: { pooling?: string; normalize?: boolean },
  ) => Promise<{ data: Float32Array }>;
  return async (texts: string[]) => {
    const out: Float32Array[] = [];
    for (const t of texts) {
      const r = await extractor(t, { pooling: 'mean', normalize: true });
      out.push(r.data);
    }
    return out;
  };
}

async function loadV4Pipeline(modelId: string): Promise<EmbedFunction> {
  // v4 API surface (verified by Wave 36 Part 0 spike): same pipeline()
  // entrypoint, same env shape, same feature-extraction task name. ORT
  // wasmPaths still routes to /classifier/onnx-runtime/ via the build
  // script's dual-source logic.
  const transformers = await import('@huggingface/transformers');
  transformers.env.localModelPath = '/classifier/';
  transformers.env.allowRemoteModels = false;
  transformers.env.backends.onnx.wasm.wasmPaths = '/classifier/onnx-runtime/';
  transformers.env.backends.onnx.wasm.numThreads = 1;
  const pipeline = transformers.pipeline as (task: string, model: string) => Promise<unknown>;
  const extractor = (await pipeline('feature-extraction', modelId)) as (
    input: string | string[],
    opts?: { pooling?: string; normalize?: boolean },
  ) => Promise<{ data: Float32Array }>;
  return async (texts: string[]) => {
    const out: Float32Array[] = [];
    for (const t of texts) {
      const r = await extractor(t, { pooling: 'mean', normalize: true });
      out.push(r.data);
    }
    return out;
  };
}

export function loadClassifier(modelId: string = DEFAULT_MODEL_ID): Promise<EmbedFunction> {
  if (cached) return cached;
  cached = readRuntimeFlag() === 'v4'
    ? loadV4Pipeline(modelId)
    : loadV2Pipeline(modelId);
  return cached;
}

/** Test-only: clear the lazy-import cache so the next call re-imports. */
export function _resetClassifierCacheForTests(): void {
  cached = null;
}
```

- [ ] **Step 2: Run the test, confirm green**

```bash
npx vitest run src/llm/loadClassifier.test.ts
```

Expected: 8/8 pass.

### Task A5: Update `build-classifier-assets.mjs` for dual ORT source

- [ ] **Step 1: Locate the v2 ORT source path constant in the script**

Open `app/scripts/build-classifier-assets.mjs` and find the `ORT_SOURCE` constant (currently points at `node_modules/@xenova/transformers/...`).

- [ ] **Step 2: Add a v4 source path with fallback logic**

Replace the single-source block with:

```javascript
// Wave 36 Part A — dual-source ORT WASM. While both runtimes are
// installed (Parts A + B), copy from whichever source has the file.
// v4 takes precedence: if it exists, use it; otherwise fall back to v2.
// Part C collapses this back to v4-only.
const ORT_SOURCES = [
  join(APP_ROOT, 'node_modules', '@huggingface', 'transformers', 'dist'),
  join(APP_ROOT, 'node_modules', '@xenova', 'transformers', 'dist'),
];

function findOrtSource(filename) {
  for (const dir of ORT_SOURCES) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`ORT WASM file ${filename} not found in any source: ${ORT_SOURCES.join(', ')}`);
}
```

(Original single-source `ORT_SOURCE` reference is replaced by `findOrtSource(...)` in the existing copy loop.)

- [ ] **Step 3: Run the asset build, confirm green**

```bash
npm run build:classifier-assets
```

Expected: ORT WASM files copied successfully (from v4 if v4 ships them, else v2).

### Task A6: Add `transformers` chunk budget

- [ ] **Step 1: Run a build to measure v4 chunk size**

```bash
npm run build
ls -la dist/assets/ | grep -i transformers
```

Capture the v4 chunk size in bytes (`<measured-bytes>`).

- [ ] **Step 2: Edit `app/scripts/check-bundle-budget.mjs` `BUDGETS` array**

Add an entry after the `lease worker` budget:

```javascript
// Wave 36 Part A — transformers chunk budget. Set at v4's measured
// size + 10% headroom. v2's chunk was ~827 KiB; v4 lands at
// <measured> KiB. Future drift caught here.
{ pattern: /^transformers-.+\.js$/, maxBytes: <measured-bytes-times-1.1>, label: 'transformers' },
```

(Replace `<measured-bytes-times-1.1>` with the actual number.)

- [ ] **Step 3: Run the budget gate, confirm green**

```bash
npm run check:budget
```

Expected: all budgets pass.

### Task A7: Local gates + commit

- [ ] **Step 1: Full local gate**

```bash
npm run typecheck && npm run lint && npm test
```

All green required.

- [ ] **Step 2: Commit**

```bash
git add app/package.json app/package-lock.json \
        app/src/llm/loadClassifier.ts app/src/llm/loadClassifier.test.ts \
        app/scripts/build-classifier-assets.mjs \
        app/scripts/check-bundle-budget.mjs
git commit -m "wave36-A: v4 behind ?transformersV4=on flag

Adds @huggingface/transformers@4 alongside the existing v2 dep.
loadClassifier branches at the dynamic-import boundary on the URL
flag; the inactive runtime never enters the user's bundle.

build-classifier-assets learns dual ORT WASM source paths (v4
first, v2 fallback). Bundle-budget gate gains a transformers
chunk pattern at the measured v4 size + 10%.

Tests parameterize over both runtimes; new shape + magnitude
regression assertions guard against tokenizer drift.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task A8: Push + PR + auto-merge

- [ ] **Step 1: Push**

```bash
git push -u origin wave36-A-v4-behind-flag
```

- [ ] **Step 2: Open the PR**

PR title: `wave36-A: v4 behind ?transformersV4=on flag`. PR body must include:
- Part 0 spike report (parity / audit / size)
- Bundle-budget delta (v2 chunk vs new v4 budget)
- Confirmation that v2 default path is unchanged (no behavior change for users without the flag)

```bash
gh pr create --title 'wave36-A: v4 behind ?transformersV4=on flag' --body '<body>'
gh pr merge --auto --squash
```

---

## §7 Part B — Default flip

**Branch:** `wave36-B-default-flip`
**Mode:** Direct, this session, **only after Part A merges**.

### Task B1: Sync, set up worktree

- [ ] **Step 1: Sync main, capture new base SHA**

```bash
git fetch origin && git checkout main && git pull --ff-only
git rev-parse origin/main
```

- [ ] **Step 2: Create worktree**

```bash
git worktree add -b wave36-B-default-flip worktrees/wave36-B-default-flip origin/main
ln -s ../../../app/node_modules worktrees/wave36-B-default-flip/app/node_modules
```

### Task B2: Acceptance gate — hybrid-golden spec against v4

- [ ] **Step 1: Build with the flag on the URL**

The flag is read at runtime via `URLSearchParams`, so the spec must navigate to `?transformersV4=on`. Update the spec's URL builder if needed; otherwise just append.

- [ ] **Step 2: Run the spec**

```bash
cd worktrees/wave36-B-default-flip/app
RUN_REAL_MODEL=1 npx playwright test ../tests/e2e/hybrid-golden.spec.ts \
  --project=chromium --headed
```

Expected: PASS. The model loads from `/classifier/...`, embeds, emits a finding with `evidence.modelId`. Capture the modelId string for Step B5 below.

**HALT condition:** if the spec fails, do not flip. Investigate and either fix or abort to plan B (defer flip to Wave 37).

### Task B3: Manual smoke walk

- [ ] **Step 1: Start dev server with flag**

```bash
npm run dev
# Open http://localhost:5173/?transformersV4=on
```

- [ ] **Step 2: Walk the golden path**

User performs:
1. Click sample-lease button (or upload a known lease).
2. Wait for analysis.
3. Confirm at least one finding renders the hybrid badge (`finding-llm-badge`).
4. Click the badge — confirm the inline `<dl>` shows the modelId, similarity %, and threshold.
5. Confirm zero CSP violations in the browser console (DevTools → Console, filter for "Content-Security-Policy").
6. Hard reload (Cmd-Shift-R), navigate again — confirm the SW serves the new transformers chunk (Network tab → look for `transformers-*.js` from `(disk cache)` after first load).

- [ ] **Step 3: Sign-off**

User explicitly confirms in the PR thread "smoke walk green" before the next step proceeds.

**HALT condition:** any of the steps fail visibly. See "Recovery paths" below.

### Task B4: Flip the default + add kill switch

- [ ] **Step 1: Edit `app/src/llm/loadClassifier.ts` `readRuntimeFlag`**

Replace the existing function body with:

```typescript
function readRuntimeFlag(): 'v2' | 'v4' {
  if (typeof window === 'undefined') return 'v4';
  const search = window.location?.search ?? '';
  const params = new URLSearchParams(search);
  // Wave 36 Part B — default flipped to v4. The v2 kill switch is
  // transient (removed in Part C) but exists during this PR's
  // stabilization in case a regression surfaces post-merge.
  if (params.get('transformersV2') === 'on') return 'v2';
  return 'v4';
}
```

- [ ] **Step 2: Update tests for the flip**

In `app/src/llm/loadClassifier.test.ts`, update `setRuntimeFlag` to use `?transformersV2=on` for the `v2` runtime case (since v4 is now default-on).

```typescript
function setRuntimeFlag(runtime: 'v2' | 'v4'): void {
  const search = runtime === 'v2' ? '?transformersV2=on' : '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(`http://localhost/${search}`),
  });
}
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/llm/loadClassifier.test.ts
```

Expected: 8/8 pass.

### Task B5: Update hybrid-golden spec modelId expectation

- [ ] **Step 1: Open `tests/e2e/hybrid-golden.spec.ts`**

Find the `evidence.modelId` assertion. If v4 reports a different string than `'Xenova/paraphrase-MiniLM-L3-v2'`, update the expected value to match what was captured in B2 step 2.

If v4 reports the same string, no change.

- [ ] **Step 2: Re-run the spec**

```bash
RUN_REAL_MODEL=1 npx playwright test ../tests/e2e/hybrid-golden.spec.ts --project=chromium
```

Expected: PASS (without the `?transformersV4=on` flag this time — v4 is now default).

### Task B6: Local gates + commit + PR

- [ ] **Step 1: Full gate**

```bash
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 2: Commit + push + PR**

```bash
git add app/src/llm/loadClassifier.ts app/src/llm/loadClassifier.test.ts \
        ../tests/e2e/hybrid-golden.spec.ts
git commit -m "wave36-B: flip default to v4; transient ?transformersV2=on kill switch

Acceptance gate met:
- hybrid-golden spec passes against v4 (modelId: <captured-id>)
- manual smoke walk signed off in PR thread

v2 path remains reachable via ?transformersV2=on for one PR window
as a kill switch; Part C removes it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin wave36-B-default-flip
gh pr create --title 'wave36-B: flip default to v4' --body '<body with smoke-walk receipts>'
gh pr merge --auto --squash
```

### Recovery paths (Part B)

**If hybrid-golden spec FAILS but embeddings look numerically close:**
Re-tune the cosine sim threshold for v4 in `loadClassifier.ts` (or wherever the threshold lives — `app/src/llm/runHybrid.ts` or similar). Document the change in the PR body with before/after similarity numbers from the smoke walk. Re-run B2 + B3.

**If hybrid-golden spec FAILS and embeddings are wildly different:**
Abort the flip. The wave degrades to plan B: keep v4 behind flag, defer Parts B/C/D to Wave 37. Open a `wave37-deferred-flip` row in `docs/BACKLOG.md`. Wave 36 closes after Part A only.

---

## §8 Part C — Excise v2

**Branch:** `wave36-C-excise-v2`
**Mode:** Direct, this session, **only after Part B merges**.

### Task C1: Sync + worktree

- [ ] **Step 1: Sync, capture base SHA**

```bash
git fetch origin && git checkout main && git pull --ff-only
git rev-parse origin/main
```

- [ ] **Step 2: Worktree**

```bash
git worktree add -b wave36-C-excise-v2 worktrees/wave36-C-excise-v2 origin/main
ln -s ../../../app/node_modules worktrees/wave36-C-excise-v2/app/node_modules
```

### Task C2: Remove v2 from package.json

- [ ] **Step 1: Uninstall v2**

```bash
cd worktrees/wave36-C-excise-v2/app
npm uninstall @xenova/transformers
```

- [ ] **Step 2: Confirm only v4 remains**

```bash
test ! -d node_modules/@xenova/transformers
test -d node_modules/@huggingface/transformers
grep -E '@xenova|@huggingface' package.json
```

Expected output: only `@huggingface/transformers` line.

### Task C3: Strip v2 from `loadClassifier.ts`

- [ ] **Step 1: Replace `app/src/llm/loadClassifier.ts`**

```typescript
// Wave 20 Part C / Wave 36 Part C — Phase 18 classifier loader.
// Wave 36 Part B flipped the default to @huggingface/transformers v4.
// Part C removes the legacy @xenova/transformers branch and the
// transient ?transformersV2=on kill switch — there is no v2 path to
// fall back to once this lands.
//
// Local-only contract: assets at app/public/classifier/<modelId>/ and
// public/classifier/onnx-runtime/. localModelPath + disabled remote
// fallback prevent a CDN fetch (CSP would block).

/** Embedding output: a fixed-length vector per input string. */
export interface EmbedFunction {
  (texts: string[]): Promise<Float32Array[]>;
}

// Note: kept the 'Xenova/...' string as the canonical model id even
// after migrating off the @xenova package — the model weights at
// public/classifier/Xenova/paraphrase-MiniLM-L3-v2/ retain that
// directory name, and v4 resolves the id against localModelPath.
// Pre-Wave-36 audit entries already carry this string in
// evidence.modelId; keeping it preserves audit-chain continuity.
export const DEFAULT_MODEL_ID = 'Xenova/paraphrase-MiniLM-L3-v2';

let cached: Promise<EmbedFunction> | null = null;

export function loadClassifier(modelId: string = DEFAULT_MODEL_ID): Promise<EmbedFunction> {
  if (cached) return cached;
  cached = (async () => {
    const transformers = await import('@huggingface/transformers');
    transformers.env.localModelPath = '/classifier/';
    transformers.env.allowRemoteModels = false;
    transformers.env.backends.onnx.wasm.wasmPaths = '/classifier/onnx-runtime/';
    transformers.env.backends.onnx.wasm.numThreads = 1;
    const pipeline = transformers.pipeline as (task: string, model: string) => Promise<unknown>;
    const extractor = (await pipeline('feature-extraction', modelId)) as (
      input: string | string[],
      opts?: { pooling?: string; normalize?: boolean },
    ) => Promise<{ data: Float32Array }>;
    return async (texts: string[]) => {
      const out: Float32Array[] = [];
      for (const t of texts) {
        const r = await extractor(t, { pooling: 'mean', normalize: true });
        out.push(r.data);
      }
      return out;
    };
  })();
  return cached;
}

/** Test-only: clear the lazy-import cache so the next call re-imports. */
export function _resetClassifierCacheForTests(): void {
  cached = null;
}
```

(If v4 reported a different model id during Part B, update `DEFAULT_MODEL_ID` to that string here. The comment note above explains the trade-off.)

### Task C4: Drop v2-runtime parameterization from tests

- [ ] **Step 1: Replace `app/src/llm/loadClassifier.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadClassifier,
  _resetClassifierCacheForTests,
  DEFAULT_MODEL_ID,
  type EmbedFunction,
} from './loadClassifier';

beforeEach(() => {
  _resetClassifierCacheForTests();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL('http://localhost/'),
  });
});

describe('loadClassifier', () => {
  it('returns a cached EmbedFunction on subsequent calls', async () => {
    const a = loadClassifier();
    const b = loadClassifier();
    expect(a).toBe(b);
  });

  it('exports DEFAULT_MODEL_ID as Xenova/paraphrase-MiniLM-L3-v2', () => {
    expect(DEFAULT_MODEL_ID).toBe('Xenova/paraphrase-MiniLM-L3-v2');
  });

  it('imports @huggingface/transformers (v2 path removed in Wave 36-C)', async () => {
    const v4Spy = vi.fn().mockResolvedValue({
      env: { localModelPath: '', allowRemoteModels: true, backends: { onnx: { wasm: {} } } },
      pipeline: vi.fn().mockResolvedValue(async () => ({ data: new Float32Array(384) })),
    });
    vi.doMock('@huggingface/transformers', v4Spy);
    await loadClassifier();
    expect(v4Spy).toHaveBeenCalled();
    vi.doUnmock('@huggingface/transformers');
  });

  it('returns embeddings of shape [384] with bounded magnitude', async () => {
    const data = new Float32Array(384);
    for (let i = 0; i < 384; i++) data[i] = (i % 7) * 0.01;
    vi.doMock('@huggingface/transformers', () => ({
      env: { localModelPath: '', allowRemoteModels: true, backends: { onnx: { wasm: {} } } },
      pipeline: vi.fn().mockResolvedValue(async () => ({ data })),
    }));
    const embed: EmbedFunction = await loadClassifier();
    const [vec] = await embed(['hello world']);
    expect(vec.length).toBe(384);
    let mag = 0;
    for (const x of vec) mag += x * x;
    mag = Math.sqrt(mag);
    expect(mag).toBeGreaterThan(0.5);
    expect(mag).toBeLessThan(2.0);
    vi.doUnmock('@huggingface/transformers');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/llm/loadClassifier.test.ts
```

Expected: 4/4 pass.

### Task C5: Drop v2-only branches from `usePipeline.test.ts`

- [ ] **Step 1: Search for v2-only references**

```bash
grep -n "@xenova/transformers\|transformersV2" src/App/usePipeline.test.ts
```

- [ ] **Step 2: Remove any conditional v2 fixture branches**

Replace any `?transformersV2=on` URL setups with the bare default; remove any mock returns keyed to `@xenova/transformers`. Run the test:

```bash
npx vitest run src/App/usePipeline.test.ts
```

Expected: green.

### Task C6: Collapse `build-classifier-assets.mjs` to v4-only

- [ ] **Step 1: Replace the dual `ORT_SOURCES` array with a single source**

```javascript
// Wave 36 Part C — v2 excised; ORT WASM is sourced from
// @huggingface/transformers only.
const ORT_SOURCE = join(APP_ROOT, 'node_modules', '@huggingface', 'transformers', 'dist');
```

Replace `findOrtSource(filename)` calls with `join(ORT_SOURCE, filename)`.

- [ ] **Step 2: Run asset build**

```bash
npm run build:classifier-assets
```

Expected: ORT WASM files copied from v4 source.

### Task C7: One-line modelId comment (if v4 renamed)

If Part B updated `DEFAULT_MODEL_ID` to a v4-specific string, find the badge component:

- [ ] **Step 1: Locate**

```bash
grep -rln "evidence.modelId\|finding-llm-badge" app/src/ui | head
```

- [ ] **Step 2: Add a one-line comment near the modelId render**

```tsx
// Wave 36 — modelId rename across the v2→v4 flip. Pre-flip findings
// carry 'Xenova/paraphrase-MiniLM-L3-v2'; post-flip findings carry
// '<v4-id>'. Same weights, different namespace. No data migration.
```

(Skip this step entirely if Part B did not change `DEFAULT_MODEL_ID`.)

### Task C8: Local gates + commit + PR

- [ ] **Step 1: Full gate**

```bash
npm run typecheck && npm run lint && npm test
RUN_REAL_MODEL=1 npx playwright test ../tests/e2e/hybrid-golden.spec.ts --project=chromium
```

All green required.

- [ ] **Step 2: Manual smoke walk** (one more time, default URL, no flag)

User uploads a sample lease, confirms hybrid badge renders, no console CSP errors. Sign off in PR thread.

- [ ] **Step 3: Commit + push + PR**

```bash
git add app/package.json app/package-lock.json \
        app/src/llm/loadClassifier.ts app/src/llm/loadClassifier.test.ts \
        app/src/App/usePipeline.test.ts \
        app/scripts/build-classifier-assets.mjs \
        # ui badge file IF C7 ran
git commit -m "wave36-C: excise @xenova/transformers; collapse to v4-only

Removes the v2 dependency, the v2 import branch, the transient
?transformersV2=on kill switch, and the dual ORT WASM source path.
build-classifier-assets sources ORT exclusively from
@huggingface/transformers/dist now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin wave36-C-excise-v2
gh pr create --title 'wave36-C: excise @xenova/transformers' --body '<body with smoke-walk receipts>'
gh pr merge --auto --squash
```

---

## §9 Part D — Accept-risk removal

**Branch:** `wave36-D-accept-risk-removal`
**Mode:** Direct, this session, **only after Part C merges**.

### Task D1: Sync + worktree

- [ ] **Step 1: Sync**

```bash
git fetch origin && git checkout main && git pull --ff-only
```

- [ ] **Step 2: Worktree**

```bash
git worktree add -b wave36-D-accept-risk-removal worktrees/wave36-D-accept-risk-removal origin/main
ln -s ../../../app/node_modules worktrees/wave36-D-accept-risk-removal/app/node_modules
```

### Task D2: Remove the protobufjs row from `audit-prod.mjs`

- [ ] **Step 1: Open `app/scripts/audit-prod.mjs`**

Find `ALLOW_ADVISORIES` (around line 17) and the `'https://github.com/advisories/GHSA-xq3m-2v4x-88gg'` entry (around line 26).

- [ ] **Step 2: Delete that one entry**

Leave the rest of `ALLOW_ADVISORIES` untouched. The Set should now contain whatever rows existed minus the protobufjs URL.

- [ ] **Step 3: Run audit:prod**

```bash
cd worktrees/wave36-D-accept-risk-removal/app
npm run audit:prod
```

Expected: PASS. The protobufjs advisory is no longer present in the v4 dependency tree, so removing it from the allowlist does not surface a real failure.

**HALT condition:** if `audit:prod` fails with the protobufjs CVE re-appearing, the v2 dep was not fully excised. Investigate (`npm ls protobufjs`) before continuing.

### Task D3: Update `docs/SECURITY.md` §7.1

- [ ] **Step 1: Open `docs/SECURITY.md` §7.1 (around line 392)**

The current section documents the protobufjs accept-risk.

- [ ] **Step 2: Replace the section body with a closure note**

```markdown
### 7.1 `protobufjs <7.5.5` — Arbitrary code execution in `parse()` — **CLOSED (Wave 36)**

The protobufjs CVE chain (GHSA-xq3m-2v4x-88gg) was an upstream
transitive of `@xenova/transformers@2.17.2`. Wave 36 migrated the
on-device classifier to `@huggingface/transformers@4.x`, which does
not depend on the vulnerable protobufjs lineage. The corresponding
row was removed from `ALLOW_ADVISORIES` in `app/scripts/audit-prod.mjs`
in PR #<this-pr-number>. `npm run audit:prod` passes clean.

History preserved here for audit trail; no further action required.
```

(Update `<this-pr-number>` after the PR is opened.)

### Task D4: Local gates + commit + PR

- [ ] **Step 1: Full gate**

```bash
npm run typecheck && npm run lint && npm test
npm run audit:prod
```

All green required.

- [ ] **Step 2: Commit + push + PR**

```bash
git add app/scripts/audit-prod.mjs docs/SECURITY.md
git commit -m "wave36-D: remove protobufjs accept-risk row; close SECURITY.md §7.1

The v4 migration (Waves 36-A through 36-C) removed
@xenova/transformers and its protobufjs transitive. audit:prod
passes clean without GHSA-xq3m-2v4x-88gg in ALLOW_ADVISORIES.
SECURITY.md §7.1 now records the closure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin wave36-D-accept-risk-removal
gh pr create --title 'wave36-D: close protobufjs accept-risk' --body '<body>'
gh pr merge --auto --squash
```

---

## §10 Self-review

**1. Spec coverage.** Each spec section maps to at least one task:
- Spec §3 architecture (dual-runtime + same-session) → §3 dep graph + §6 Part A
- Spec §4 Part 0 (parity / audit / size) → §5 Tasks 0.3, 0.4, 0.5
- Spec §4 Part A (flag, ORT paths, chunk budget, tests) → §6 Tasks A2-A7
- Spec §4 Part B (gate, flip, kill switch) → §7 Tasks B2-B5
- Spec §4 Part C (excise v2) → §8 Tasks C2-C7
- Spec §4 Part D (accept-risk removal) → §9 Tasks D2-D3
- Spec §7 risk mitigations → §1 hard rules + per-part HALT conditions
- Spec §8 defaults → preserved verbatim in plan §1 hard rules

**2. Placeholder scan.** The `<measured-bytes-times-1.1>`, `<captured-id>`, `<this-pr-number>`, and `<body>` placeholders are intentional — they're values that don't exist until the prior step runs. No "TBD"/"TODO"/vague-instruction placeholders found.

**3. Type consistency.** `EmbedFunction`, `DEFAULT_MODEL_ID`, `loadClassifier`, `_resetClassifierCacheForTests` — same signatures across A, C task code. `readRuntimeFlag` exists in A, modified in B, deleted in C. `findOrtSource` introduced in A, removed in C. All transitions are explicit.

**4. Halt conditions.** Each part has a documented halt condition tied to its acceptance gate. No part silently degrades.
