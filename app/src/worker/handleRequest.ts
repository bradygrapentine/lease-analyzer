import { parseLease } from '../parser/parseLease';
import { analyze } from '../rules/analyze';
import type { WorkerRequest, WorkerResponse } from './types';

/**
 * Pure (except for parser I/O) request handler. Extracted so unit tests
 * can exercise the worker's contract without touching `self.onmessage`.
 *
 * The worker entry point (`leaseWorker.ts`) is a trivial adapter that
 * piping `postMessage` data through this function.
 */
export async function handleWorkerRequest(req: WorkerRequest): Promise<WorkerResponse> {
  try {
    if (req.kind !== 'parse-analyze') {
      // Exhaustiveness guard — if the union grows, TS will flag this line.
      const never: never = req.kind;
      return { id: (req as { id: number }).id, ok: false, error: `unknown kind: ${String(never)}` };
    }
    const doc = await parseLease(req.bytes);
    const findings = analyze(doc, req.rules);
    return { id: req.id, ok: true, doc, findings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : undefined;
    return { id: req.id, ok: false, error: message, errorName: name };
  }
}
