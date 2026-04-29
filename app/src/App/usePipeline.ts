import { useCallback, useMemo, useRef, useState } from 'react';
import { type AnalysisResult } from '../ui/analyzeFile';
import { runOcr } from '../ocr/runOcr';
import { analyze } from '../rules/analyze';
import { runClassifierPass, runHybridAnalyze, type EmbedFunction } from '../rules/hybridAnalyze';
import { isPhase18Enabled } from '../llm/featureFlag';
import { DEFAULT_MODEL_ID, loadClassifier } from '../llm/loadClassifier';
import { RULE_PACK_V1 } from '../rules/packV1';
import type { Rule } from '../rules/types';
import { getLease, getStandardId, saveLease, type LeaseRecord } from '../storage/storage';
import { PasswordProtectedPdfError } from '../parser/types';
import { copyBytes } from '../parser/copyBytes';
import { createLeaseWorkerClient } from '../worker/leaseWorkerClient';
import type { PipelineClient } from '../worker/types';

export type PipelineStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; fileName: string }
  | {
      kind: 'analyzed';
      fileName: string;
      result: AnalysisResult;
      bytes: Uint8Array | null;
      /** Storage id for this lease (used by Phase 9 annotations). */
      leaseId: string | null;
    }
  | { kind: 'error'; message: string };

export type OcrState =
  | { kind: 'idle' }
  | { kind: 'running'; pct: number; stage: string }
  | { kind: 'error'; message: string };

export interface PipelineApi {
  status: PipelineStatus;
  ocrState: OcrState;
  comparison: { a: LeaseRecord; b: LeaseRecord } | null;
  /** Upload + parse + analyze + save + auto-compare. */
  upload: (bytes: Uint8Array, fileName: string) => Promise<void>;
  /** Re-run analyze over the currently loaded doc via OCR. */
  ocr: (language?: string) => Promise<void>;
  /** Overwrite status to `analyzed` with a pre-loaded LeaseRecord (e.g. opening from library). */
  open: (record: LeaseRecord) => void;
  /**
   * Re-run `analyze(doc, rules)` over the currently-loaded document using the
   * hook's current `rules`. No-op unless `status.kind === 'analyzed'`. Used by
   * the jurisdiction picker / severity override flow to refresh findings
   * without re-parsing the PDF.
   */
  reanalyze: () => void;
  /** Force status back to idle (used by clear-all / import archive). */
  reset: () => void;
  /** Set an external error (e.g. a failed sample fetch). */
  setError: (message: string) => void;
  /** Set the current comparison pair (used by the compare picker). */
  setComparison: (pair: { a: LeaseRecord; b: LeaseRecord } | null) => void;
}

export interface UsePipelineDeps {
  /** Called after a successful save so the caller can refresh their library view. */
  onLibraryChange?: () => void | Promise<void>;
  /**
   * Rules to run on upload + OCR. Defaults to the built-in pack. Phase 10
   * rule-pack installs override this by resolving active rules at call time.
   */
  rules?: Rule[];
  /**
   * Pipeline client used for parse+analyze. Defaults to an auto-selected
   * client (Web Worker in real browsers, inline fallback in jsdom). Tests
   * can inject a deterministic stub to avoid worker plumbing.
   *
   * Phase 13 addition — purely additive; existing callers keep the old
   * main-thread behavior transparently (the inline fallback IS the old
   * main-thread pipeline).
   */
  pipelineClient?: PipelineClient;
  /**
   * Optional audit callback. When supplied AND Phase 18's flag is on,
   * the hybrid analyze path threads this through `runHybridAnalyze`'s
   * `audit` parameter so each LLM-derived finding fires one
   * `kind: 'llm-classify'` entry. App.tsx passes its `safeAudit`
   * wrapper here so audit-write failures stay swallowed.
   *
   * Wave 23-B addition — purely additive; existing callers (tests
   * that don't care about audit attestation) can omit it.
   */
  audit?: (entry: { kind: string; payload: Record<string, unknown> }) => Promise<void> | void;
}

/**
 * Best-effort load of the on-device classifier. Returns null when the
 * model files haven't been dropped (`npm run build:classifier-assets`
 * not run) OR when transformers.js fails to bootstrap (e.g. WebGPU
 * unavailable in jsdom). Either way the hybrid path silently falls
 * back to the deterministic engine.
 */
async function loadClassifierEmbedFn(): Promise<EmbedFunction | null> {
  try {
    return await loadClassifier();
  } catch {
    return null;
  }
}

/**
 * Extraction of App's handleBytes + OCR + auto-compare + save pipeline.
 *
 * Every side effect here previously lived inline in `App.tsx`; behavior
 * must be byte-identical so the existing App tests keep passing.
 *
 * The hook intentionally owns `status`, `ocrState`, and `comparison`:
 * they all transition together (loading → analyzed resets comparison,
 * OCR rewrites `status.result`, etc.) and leaking them to App as
 * separate states re-invites the spaghetti we just untangled.
 */
export function usePipeline(deps: UsePipelineDeps = {}): PipelineApi {
  const [status, setStatus] = useState<PipelineStatus>({ kind: 'idle' });
  const [ocrState, setOcrState] = useState<OcrState>({ kind: 'idle' });
  const [comparison, setComparisonState] = useState<{ a: LeaseRecord; b: LeaseRecord } | null>(
    null,
  );

  // Wave 50 — every upload increments this token. Late callbacks from a
  // previous upload (analyze finishes after a new file was selected) check
  // the token and no-op if the user has moved on. Prevents the stuck
  // "Analyzing X" status the perf probe surfaced.
  const uploadTokenRef = useRef(0);

  const { onLibraryChange, rules, pipelineClient, audit } = deps;
  const activeRules = rules ?? RULE_PACK_V1;

  // Memoize the auto-selected client so we don't spin up a new Worker per
  // render. When a caller injects `pipelineClient`, we use it directly and
  // skip auto-selection (useful for tests).
  const defaultClient = useMemo<PipelineClient>(() => createLeaseWorkerClient(), []);
  const client = pipelineClient ?? defaultClient;

  const upload = useCallback(
    async (bytes: Uint8Array, fileName: string): Promise<void> => {
      const myToken = ++uploadTokenRef.current;
      const isCurrent = (): boolean => uploadTokenRef.current === myToken;
      setStatus({ kind: 'loading', fileName });
      setComparisonState(null);
      try {
        // pdf.js transfers ownership of the ArrayBuffer during parse, so we
        // hand the worker (or inline pipeline) a dedicated copy and keep
        // the original for the viewer. The worker-backed client also
        // transfers the copy's buffer; the viewer's copy is untouched.
        const baseResult: AnalysisResult = await client.parseAndAnalyze(
          copyBytes(bytes),
          activeRules,
        );
        // Phase 18 hybrid path on the upload flow (Wave 24-A): run the
        // classifier pass on the main thread after the worker returns
        // deterministic findings. Worker source stays untouched —
        // transformers.js + WebGPU don't currently fit in the worker.
        // When the flag is off OR the classifier files are missing OR
        // transformers.js fails to bootstrap, this is a no-op and the
        // upload path stays byte-identical to Wave 23.
        let result = baseResult;
        if (isPhase18Enabled()) {
          const embedFn = await loadClassifierEmbedFn();
          if (embedFn) {
            const extras = await runClassifierPass({
              doc: baseResult.doc,
              rules: activeRules,
              baseFindings: baseResult.findings,
              embedFn,
              ...(audit ? { audit } : {}),
              modelId: DEFAULT_MODEL_ID,
            });
            if (extras.length > 0) {
              result = {
                doc: baseResult.doc,
                findings: [...baseResult.findings, ...extras],
              };
            }
          }
        }
        const newId = await saveLease({
          name: fileName,
          doc: result.doc,
          findings: result.findings,
        });
        if (onLibraryChange) await onLibraryChange();
        if (!isCurrent()) return;
        setStatus({ kind: 'analyzed', fileName, result, bytes, leaseId: newId });

        // Auto-compare against the standard, if one exists and it isn't this lease.
        const std = await getStandardId();
        if (!isCurrent()) return;
        if (std && std !== newId) {
          const standard = await getLease(std);
          if (!isCurrent()) return;
          if (standard) {
            setComparisonState({
              a: standard,
              b: {
                id: newId,
                name: fileName,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rulePackVersion: result.findings[0]?.rulePackVersion ?? 'unknown',
                pageCount: result.doc.pages.length,
                findingCount: result.findings.length,
                doc: result.doc,
                findings: result.findings,
              },
            });
          }
        }
      } catch (err) {
        if (!isCurrent()) return;
        setStatus({ kind: 'error', message: friendlyError(err) });
      }
    },
    [onLibraryChange, activeRules, client, audit],
  );

  const ocr = useCallback(
    async (language?: string): Promise<void> => {
      if (status.kind !== 'analyzed' || !status.bytes) return;
      setOcrState({ kind: 'running', pct: 0, stage: 'starting' });
      try {
        // pdf.js transfers the ArrayBuffer during parse, so hand runOcr a copy
        // and keep the original for the viewer.
        const doc = await runOcr(copyBytes(status.bytes), {
          onProgress: (p) => setOcrState({ kind: 'running', pct: p.pct, stage: p.stage }),
          ...(language ? { language } : {}),
        });
        // Phase 18 hybrid path: deterministic engine first; the optional
        // classifier pass only adds findings when the flag is on AND an
        // embedFn loads cleanly. Wave 23-B wires loadClassifier here;
        // when the classifier files are missing OR transformers.js fails
        // to bootstrap (e.g. jsdom, no WebGPU), `loadClassifierEmbedFn`
        // returns null and the wrapper degrades to plain analyze().
        const hybridEnabled = isPhase18Enabled();
        const hybridEmbedFn: EmbedFunction | null = hybridEnabled
          ? await loadClassifierEmbedFn()
          : null;
        const findings = await runHybridAnalyze({
          doc,
          rules: activeRules,
          enabled: hybridEnabled,
          embedFn: hybridEmbedFn,
          ...(audit ? { audit } : {}),
          modelId: DEFAULT_MODEL_ID,
        });
        setStatus({
          kind: 'analyzed',
          fileName: status.fileName,
          result: { doc, findings },
          bytes: status.bytes,
          leaseId: status.leaseId,
        });
        setOcrState({ kind: 'idle' });
      } catch (err) {
        setOcrState({ kind: 'error', message: friendlyError(err) });
      }
    },
    [status, activeRules, audit],
  );

  const reanalyze = useCallback((): void => {
    setStatus((prev) => {
      if (prev.kind !== 'analyzed') return prev;
      const findings = analyze(prev.result.doc, activeRules);
      return {
        kind: 'analyzed',
        fileName: prev.fileName,
        result: { doc: prev.result.doc, findings },
        bytes: prev.bytes,
        leaseId: prev.leaseId,
      };
    });
  }, [activeRules]);

  const open = useCallback((record: LeaseRecord): void => {
    setStatus({
      kind: 'analyzed',
      fileName: record.name,
      result: { doc: record.doc, findings: record.findings },
      bytes: null,
      leaseId: record.id,
    });
  }, []);

  const reset = useCallback((): void => {
    setStatus({ kind: 'idle' });
    setComparisonState(null);
  }, []);

  const setError = useCallback((message: string): void => {
    setStatus({ kind: 'error', message });
  }, []);

  const setComparison = useCallback((pair: { a: LeaseRecord; b: LeaseRecord } | null): void => {
    setComparisonState(pair);
  }, []);

  return {
    status,
    ocrState,
    comparison,
    upload,
    ocr,
    open,
    reanalyze,
    reset,
    setError,
    setComparison,
  };
}

function friendlyError(err: unknown): string {
  if (err instanceof PasswordProtectedPdfError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
