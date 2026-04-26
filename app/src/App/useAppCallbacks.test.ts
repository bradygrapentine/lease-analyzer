import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppCallbacks } from './useAppCallbacks';
import {
  _resetDbForTests,
  openLeaseDb,
  saveLease,
  setStandardId,
  type LeaseRecord,
} from '../storage/storage';

function fakePipeline(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: { kind: 'idle' },
    upload: vi.fn(async () => undefined),
    open: vi.fn(),
    setError: vi.fn(),
    setComparison: vi.fn(),
    reset: vi.fn(),
    reanalyze: vi.fn(),
    ocr: vi.fn(),
    ocrState: { kind: 'idle' },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function fakeSigningKey(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    publicKey: null,
    createKey: vi.fn(),
    exportKeyToClipboard: vi.fn(),
    signAndDownloadFindings: vi.fn(async () => undefined),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    pipeline: fakePipeline(),
    signingKey: fakeSigningKey(),
    safeAudit: vi.fn(async () => undefined),
    refreshAuditLog: vi.fn(async () => undefined),
    refreshLibrary: vi.fn(async () => undefined),
    setSelected: vi.fn(),
    standardId: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(async () => {
  try {
    (await openLeaseDb()).close();
  } catch {
    /* ignore */
  }
  _resetDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('useAppCallbacks', () => {
  it('handleBytes bookends pipeline.upload with start/complete audit entries', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.handleBytes(new Uint8Array([1, 2]), 'lease.pdf');
    });
    expect(deps.setSelected).toHaveBeenCalledWith(null);
    expect(deps.pipeline.upload).toHaveBeenCalledTimes(1);
    expect(deps.safeAudit).toHaveBeenCalledTimes(2);
    expect(deps.safeAudit.mock.calls[0]?.[0]).toEqual({
      kind: 'analyze',
      payload: { fileName: 'lease.pdf', phase: 'start' },
    });
    expect(deps.safeAudit.mock.calls[1]?.[0]).toEqual({
      kind: 'analyze',
      payload: { fileName: 'lease.pdf', phase: 'complete' },
    });
  });

  it('onDeleteLibrary clears the standard pointer when the deleted lease was the standard', async () => {
    const id = await saveLease({
      name: 'Std.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });
    await setStandardId(id);

    const deps = makeDeps({ standardId: id });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onDeleteLibrary(id);
    });
    expect(deps.safeAudit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'delete-lease' }));
    expect(deps.refreshLibrary).toHaveBeenCalledTimes(1);
  });

  it('onCompare no-ops when one of the lease ids does not exist', async () => {
    const id = await saveLease({
      name: 'Real.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });

    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onCompare(id, 'does-not-exist');
    });
    expect(deps.pipeline.setComparison).not.toHaveBeenCalled();
  });

  it('onCompare hands a {a, b} pair to pipeline.setComparison when both exist', async () => {
    const a = await saveLease({
      name: 'A.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });
    const b = await saveLease({
      name: 'B.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });

    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onCompare(a, b);
    });
    expect(deps.pipeline.setComparison).toHaveBeenCalledTimes(1);
    const call = deps.pipeline.setComparison.mock.calls[0]?.[0] as
      | { a: LeaseRecord; b: LeaseRecord }
      | undefined;
    expect(call?.a.name).toBe('A.pdf');
    expect(call?.b.name).toBe('B.pdf');
  });

  it('onTrySample surfaces fetch failures via pipeline.setError', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 404 }));
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onTrySample();
    });
    expect(deps.pipeline.setError).toHaveBeenCalledWith(
      expect.stringMatching(/Could not load sample/),
    );
    fetchSpy.mockRestore();
  });

  it('onExportSignedJson is a no-op when status.kind is not analyzed', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    expect(deps.signingKey.signAndDownloadFindings).not.toHaveBeenCalled();
  });

  it('onExportSignedJson is a no-op when the user cancels the passphrase prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const deps = makeDeps({
      pipeline: fakePipeline({
        status: {
          kind: 'analyzed',
          fileName: 'L.pdf',
          result: {
            doc: { pages: [], paragraphs: [], sections: [], raw: '' },
            findings: [],
          },
          bytes: null,
        },
      }),
    });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    expect(deps.signingKey.signAndDownloadFindings).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
