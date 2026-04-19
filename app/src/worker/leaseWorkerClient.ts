import type { LeaseDocument } from '../parser/types';
import type { Finding, Rule } from '../rules/types';
import { createInlinePipelineClient } from './inlinePipeline';
import type { PipelineClient, WorkerRequest, WorkerResponse } from './types';

/**
 * Minimal Worker surface we rely on. Both `globalThis.Worker` and our test
 * fakes satisfy this shape.
 */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((ev: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
  onmessageerror?: ((ev: MessageEvent) => void) | null;
}

export type WorkerFactory = () => WorkerLike;

/**
 * Build a `PipelineClient` that dispatches `parse-analyze` to a dedicated
 * Web Worker. The Uint8Array's underlying ArrayBuffer is transferred to
 * the worker, so callers must hand in a dedicated copy — the main-thread
 * PDF viewer bytes must be separate (see App.tsx's double-copy pattern).
 *
 * Request correlation is keyed by a monotonic id; the promise is resolved
 * on the matching response, or rejected on a transport-level error.
 */
export function createWorkerPipelineClient(factory: WorkerFactory): PipelineClient {
  const worker = factory();
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (v: { doc: LeaseDocument; findings: Finding[] }) => void;
      reject: (err: Error) => void;
    }
  >();

  worker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
    const resp = ev.data;
    const entry = pending.get(resp.id);
    if (!entry) return;
    pending.delete(resp.id);
    if (resp.ok) {
      entry.resolve({ doc: resp.doc, findings: resp.findings });
    } else {
      const err = new Error(resp.error);
      if (resp.errorName) err.name = resp.errorName;
      entry.reject(err);
    }
  };

  worker.onerror = (ev: { message?: string }): void => {
    // Transport-level crash: fail every in-flight request, then clear.
    const err = new Error(ev.message ?? 'worker error');
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  };

  return {
    parseAndAnalyze(
      bytes: Uint8Array,
      rules: Rule[],
      rulePackVersion?: string,
    ): Promise<{ doc: LeaseDocument; findings: Finding[] }> {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const req: WorkerRequest = { id, kind: 'parse-analyze', bytes, rules, rulePackVersion };
        try {
          worker.postMessage(req, [bytes.buffer]);
        } catch (err) {
          pending.delete(id);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },
    terminate(): void {
      worker.terminate();
      const err = new Error('worker terminated');
      for (const entry of pending.values()) entry.reject(err);
      pending.clear();
    },
  };
}

/**
 * Auto-select the best `PipelineClient` for the current environment.
 *
 * - In a real browser (with `Worker` available), uses the dedicated
 *   module-worker chunk at `./leaseWorker.ts`. Vite resolves the URL at
 *   build time so the worker ships as a same-origin chunk (no CDN).
 * - In jsdom / non-browser runtimes, returns the inline fallback so tests
 *   don't have to stub the Worker constructor.
 *
 * Callers can still inject their own client via `usePipeline`'s new
 * `pipelineClient` option for deterministic tests.
 */
export function createLeaseWorkerClient(): PipelineClient {
  if (typeof Worker === 'undefined') return createInlinePipelineClient();
  try {
    const factory: WorkerFactory = () =>
      new Worker(new URL('./leaseWorker.ts', import.meta.url), {
        type: 'module',
        name: 'lease-worker',
      }) as unknown as WorkerLike;
    return createWorkerPipelineClient(factory);
  } catch {
    // Some environments (e.g. older Safari, Tauri edge cases) may throw on
    // module-worker construction. Fall back to the main-thread pipeline
    // rather than breaking the upload flow entirely.
    return createInlinePipelineClient();
  }
}
