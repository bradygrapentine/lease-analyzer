/// <reference lib="webworker" />
import { handleWorkerRequest } from './handleRequest';
import type { WorkerRequest } from './types';

/**
 * Dedicated Web Worker entry point for Phase 13. Kept intentionally tiny —
 * all real logic lives in `handleWorkerRequest` so it can be unit tested
 * without a Worker environment.
 *
 * IMPORTANT: this file must NOT import React or any UI code. Vite emits it
 * as a separate chunk, and we want that chunk to stay small.
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<WorkerRequest>): void => {
  const req = ev.data;
  void handleWorkerRequest(req).then((resp) => {
    // We don't transfer the response payload: doc/findings are small and
    // the caller often wants to inspect them directly on the main thread.
    ctx.postMessage(resp);
  });
};
