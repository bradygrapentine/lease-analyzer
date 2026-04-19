import { useCallback, useMemo, useState } from 'react';
import { type AnalysisResult } from '../ui/analyzeFile';
import { runOcr } from '../ocr/runOcr';
import { analyze } from '../rules/analyze';
import { RULE_PACK_V1 } from '../rules/packV1';
import type { Rule } from '../rules/types';
import { getLease, getStandardId, saveLease, type LeaseRecord } from '../storage/storage';
import { PasswordProtectedPdfError } from '../parser/types';
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
  ocr: () => Promise<void>;
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

  const { onLibraryChange, rules, pipelineClient } = deps;
  const activeRules = rules ?? RULE_PACK_V1;

  // Memoize the auto-selected client so we don't spin up a new Worker per
  // render. When a caller injects `pipelineClient`, we use it directly and
  // skip auto-selection (useful for tests).
  const defaultClient = useMemo<PipelineClient>(() => createLeaseWorkerClient(), []);
  const client = pipelineClient ?? defaultClient;

  const upload = useCallback(
    async (bytes: Uint8Array, fileName: string): Promise<void> => {
      setStatus({ kind: 'loading', fileName });
      setComparisonState(null);
      try {
        // pdf.js transfers ownership of the ArrayBuffer during parse, so we
        // hand the worker (or inline pipeline) a dedicated copy and keep
        // the original for the viewer. The worker-backed client also
        // transfers the copy's buffer; the viewer's copy is untouched.
        const result: AnalysisResult = await client.parseAndAnalyze(
          new Uint8Array(bytes),
          activeRules,
        );
        const newId = await saveLease({
          name: fileName,
          doc: result.doc,
          findings: result.findings,
        });
        if (onLibraryChange) await onLibraryChange();
        setStatus({ kind: 'analyzed', fileName, result, bytes, leaseId: newId });

        // Auto-compare against the standard, if one exists and it isn't this lease.
        const std = await getStandardId();
        if (std && std !== newId) {
          const standard = await getLease(std);
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
        setStatus({ kind: 'error', message: friendlyError(err) });
      }
    },
    [onLibraryChange, activeRules, client],
  );

  const ocr = useCallback(async (): Promise<void> => {
    if (status.kind !== 'analyzed' || !status.bytes) return;
    setOcrState({ kind: 'running', pct: 0, stage: 'starting' });
    try {
      // pdf.js transfers the ArrayBuffer during parse, so hand runOcr a copy
      // and keep the original for the viewer.
      const copy = new Uint8Array(status.bytes);
      const doc = await runOcr(copy, {
        onProgress: (p) => setOcrState({ kind: 'running', pct: p.pct, stage: p.stage }),
      });
      const findings = analyze(doc, activeRules);
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
  }, [status, activeRules]);

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

  const setComparison = useCallback(
    (pair: { a: LeaseRecord; b: LeaseRecord } | null): void => {
      setComparisonState(pair);
    },
    [],
  );

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
