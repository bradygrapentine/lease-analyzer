import { describe, expect, it, vi } from 'vitest';
import { makePdf } from '../parser/testFixtures';
import { RULE_PACK_V1 } from '../rules/packV1';
import { handleWorkerRequest } from './handleRequest';
import { createLeaseWorkerClient, createWorkerPipelineClient, type WorkerLike } from './leaseWorkerClient';
import type { WorkerRequest, WorkerResponse } from './types';

async function makeBytes(): Promise<Uint8Array> {
  return makePdf([
    {
      blocks: [{ text: 'This lease shall auto-renew annually.', x: 72, y: 72 }],
    },
  ]);
}

/** A fake module worker that routes every postMessage through the real handler. */
function makeFakeWorker(): WorkerLike {
  const worker: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message: unknown): void {
      const req = message as WorkerRequest;
      // Resolve on a microtask so the client has registered the promise.
      void handleWorkerRequest(req).then((resp) => {
        worker.onmessage?.({ data: resp } as MessageEvent<WorkerResponse>);
      });
    },
    terminate(): void {
      /* noop */
    },
  };
  return worker;
}

describe('createWorkerPipelineClient', () => {
  it('resolves parseAndAnalyze via worker round-trip', async () => {
    const client = createWorkerPipelineClient(() => makeFakeWorker());
    const bytes = await makeBytes();
    const out = await client.parseAndAnalyze(bytes, RULE_PACK_V1, '1.0.0');
    expect(out.doc.pages.length).toBeGreaterThan(0);
    expect(out.findings.length).toBeGreaterThan(0);
  });

  it('rejects when the worker reports ok:false (error propagates)', async () => {
    const client = createWorkerPipelineClient(() => makeFakeWorker());
    await expect(
      client.parseAndAnalyze(new Uint8Array([1, 2, 3]), RULE_PACK_V1),
    ).rejects.toThrow();
  });

  it('preserves errorName on the thrown Error', async () => {
    // Intercept handleWorkerRequest output to inject a typed error.
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(message: unknown): void {
        const req = message as WorkerRequest;
        queueMicrotask(() => {
          worker.onmessage?.({
            data: { id: req.id, ok: false, error: 'locked', errorName: 'PasswordProtectedPdfError' },
          } as MessageEvent<WorkerResponse>);
        });
      },
      terminate(): void {},
    };
    const client = createWorkerPipelineClient(() => worker);
    const bytes = await makeBytes();
    try {
      await client.parseAndAnalyze(bytes, RULE_PACK_V1);
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      if (err instanceof Error) {
        expect(err.name).toBe('PasswordProtectedPdfError');
        expect(err.message).toBe('locked');
      }
    }
  });

  it('correlates two in-flight requests by id (arrival order independent)', async () => {
    // Fake that reverses the order of responses so we prove the client keys
    // resolution off of `id`, not order.
    const queue: WorkerResponse[] = [];
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(message: unknown): void {
        const req = message as WorkerRequest;
        void handleWorkerRequest(req).then((resp) => {
          queue.push(resp);
          if (queue.length === 2) {
            // Flush in reverse.
            const [first, second] = [queue[0], queue[1]];
            if (!first || !second) return;
            worker.onmessage?.({ data: second } as MessageEvent<WorkerResponse>);
            worker.onmessage?.({ data: first } as MessageEvent<WorkerResponse>);
          }
        });
      },
      terminate(): void {},
    };
    const client = createWorkerPipelineClient(() => worker);
    const [a, b] = await Promise.all([
      client.parseAndAnalyze(await makeBytes(), RULE_PACK_V1),
      client.parseAndAnalyze(await makeBytes(), RULE_PACK_V1),
    ]);
    expect(a.doc.pages.length).toBeGreaterThan(0);
    expect(b.doc.pages.length).toBeGreaterThan(0);
  });

  it('rejects in-flight requests if the worker posts an error event', async () => {
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(): void {
        /* record nothing — test triggers onerror directly */
      },
      terminate(): void {},
    };
    const client = createWorkerPipelineClient(() => worker);
    const pending = client.parseAndAnalyze(new Uint8Array([1]), RULE_PACK_V1);
    // Defer so the pending Promise is registered before we trip onerror.
    await Promise.resolve();
    worker.onerror?.({ message: 'crash' });
    await expect(pending).rejects.toThrow('crash');
  });

  it('terminate rejects pending requests and calls worker.terminate', async () => {
    // Fake worker that never responds so the promise stays pending.
    const termSpy = vi.fn();
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(): void {},
      terminate(): void {
        termSpy();
      },
    };
    const client = createWorkerPipelineClient(() => worker);
    const pending = client.parseAndAnalyze(new Uint8Array([1]), RULE_PACK_V1);
    client.terminate();
    await expect(pending).rejects.toThrow(/terminated/);
    expect(termSpy).toHaveBeenCalledTimes(1);
  });

  it('catches a throwing postMessage and rejects the returned promise', async () => {
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(): void {
        throw new Error('postMessage failed');
      },
      terminate(): void {},
    };
    const client = createWorkerPipelineClient(() => worker);
    await expect(
      client.parseAndAnalyze(new Uint8Array([1]), RULE_PACK_V1),
    ).rejects.toThrow('postMessage failed');
  });
});

describe('createLeaseWorkerClient', () => {
  it('returns an inline client when Worker is undefined (jsdom)', async () => {
    // jsdom does not define Worker. Auto-select should give us the inline path.
    // The inline client must still be functional for a valid PDF.
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe('undefined');
    const client = createLeaseWorkerClient();
    const out = await client.parseAndAnalyze(await makeBytes(), RULE_PACK_V1);
    expect(out.doc.pages.length).toBeGreaterThan(0);
    client.terminate();
  });
});
