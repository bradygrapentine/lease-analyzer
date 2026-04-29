import { describe, expect, it, vi } from 'vitest';
import { makePdf } from '../parser/testFixtures';
import * as parser from '../parser/parseLease';
import { RULE_PACK_V1 } from '../rules/packV1';
import { handleWorkerRequest } from './handleRequest';
import type { ParseAnalyzeRequest } from './types';

async function makeBytes(): Promise<Uint8Array> {
  return makePdf([
    {
      blocks: [
        { text: 'This lease shall auto-renew annually.', x: 72, y: 72 },
        { text: 'Tenant waives any right to a jury trial.', x: 72, y: 110 },
      ],
    },
  ]);
}

describe('handleWorkerRequest', () => {
  it('returns ok:true with doc + findings on a valid parse-analyze request', async () => {
    const bytes = await makeBytes();
    const req: ParseAnalyzeRequest = {
      id: 1,
      kind: 'parse-analyze',
      bytes,
      rules: RULE_PACK_V1,
    };
    const resp = await handleWorkerRequest(req);
    expect(resp.id).toBe(1);
    expect(resp.ok).toBe(true);
    if (resp.ok) {
      expect(resp.doc.pages.length).toBeGreaterThan(0);
      expect(resp.findings.length).toBeGreaterThan(0);
    }
  });

  it('returns ok:false on malformed PDF bytes, preserving the request id', async () => {
    const req: ParseAnalyzeRequest = {
      id: 42,
      kind: 'parse-analyze',
      bytes: new Uint8Array([1, 2, 3]),
      rules: RULE_PACK_V1,
    };
    const resp = await handleWorkerRequest(req);
    expect(resp.id).toBe(42);
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error).toBeTruthy();
    }
  });

  it('handles empty rules list (valid — yields zero findings)', async () => {
    const bytes = await makeBytes();
    const req: ParseAnalyzeRequest = {
      id: 7,
      kind: 'parse-analyze',
      bytes,
      rules: [],
    };
    const resp = await handleWorkerRequest(req);
    expect(resp.ok).toBe(true);
    if (resp.ok) expect(resp.findings.length).toBe(0);
  });

  // Wave 26-A: exhaustiveness-guard coverage. Casting bypasses the
  // `WorkerRequest` discriminated union to fire the `unknown kind`
  // branch — in practice this triggers only when a future caller
  // adds a new request kind without updating the handler.
  // Wave 44: cover the `err instanceof Error` false branch in the
  // catch block. Real callers always see an Error from parseLease, but
  // a future parser change could throw a string/number, and the
  // handler must still return a structured response.
  it('returns ok:false when parseLease throws a non-Error value (string/undefined-name path)', async () => {
    const spy = vi.spyOn(parser, 'parseLease').mockRejectedValueOnce('string-thrown');
    try {
      const req: ParseAnalyzeRequest = {
        id: 11,
        kind: 'parse-analyze',
        bytes: new Uint8Array([1, 2, 3]),
        rules: RULE_PACK_V1,
      };
      const resp = await handleWorkerRequest(req);
      expect(resp.id).toBe(11);
      expect(resp.ok).toBe(false);
      if (!resp.ok) {
        expect(resp.error).toBe('string-thrown');
        expect(resp.errorName).toBeUndefined();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('returns ok:false with an "unknown kind" error on an unrecognized request kind', async () => {
    const req = {
      id: 99,
      kind: 'definitely-not-a-real-kind',
    } as unknown as ParseAnalyzeRequest;
    const resp = await handleWorkerRequest(req);
    expect(resp.id).toBe(99);
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error).toMatch(/unknown kind/i);
    }
  });
});
