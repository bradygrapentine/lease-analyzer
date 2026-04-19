import type { LeaseDocument } from '../parser/types';
import type { Finding, Rule } from '../rules/types';

/**
 * Phase 13 worker protocol. Each request is identified by a monotonic `id`
 * so the client can correlate responses regardless of arrival order.
 *
 * Serialization note: `bytes` is posted as a Uint8Array and its underlying
 * ArrayBuffer is transferred. `rules` and `doc` are structurally cloned —
 * they must be plain data (no functions, no class instances). Our current
 * `LeaseDocument`/`Rule`/`Finding` shapes already satisfy this.
 */
export interface ParseAnalyzeRequest {
  id: number;
  kind: 'parse-analyze';
  bytes: Uint8Array;
  rules: Rule[];
  /**
   * Advisory metadata — not used by the worker pipeline but echoed for
   * logging / audit correlation by the caller.
   */
  rulePackVersion?: string;
}

export type WorkerRequest = ParseAnalyzeRequest;

export interface ParseAnalyzeSuccess {
  id: number;
  ok: true;
  doc: LeaseDocument;
  findings: Finding[];
}

export interface ParseAnalyzeFailure {
  id: number;
  ok: false;
  error: string;
  /** Preserves the original Error#name so callers can re-hydrate typed errors. */
  errorName?: string;
}

export type WorkerResponse = ParseAnalyzeSuccess | ParseAnalyzeFailure;

/**
 * Pipeline client surface. Both the worker-backed and the inline (main-thread)
 * implementations honor this contract. `parseAndAnalyze` is allowed to take
 * ownership of `bytes` — callers must hand in a dedicated copy.
 */
export interface PipelineClient {
  parseAndAnalyze(
    bytes: Uint8Array,
    rules: Rule[],
    rulePackVersion?: string,
  ): Promise<{ doc: import('../parser/types').LeaseDocument; findings: Finding[] }>;
  terminate(): void;
}
