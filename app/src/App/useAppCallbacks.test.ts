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
    signAndDownloadFindings: vi.fn(async () => ({
      fileName: 'L-findings.signed.json',
      inputHash: null,
      signingKeyId: null,
    })),
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

  it('onOpenLibrary is a no-op when the lease id does not exist', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onOpenLibrary('does-not-exist');
    });
    expect(deps.pipeline.open).not.toHaveBeenCalled();
  });

  it('onOpenLibrary calls pipeline.open when the lease exists', async () => {
    const id = await saveLease({
      name: 'Open.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onOpenLibrary(id);
    });
    expect(deps.pipeline.open).toHaveBeenCalledTimes(1);
    expect(deps.setSelected).toHaveBeenCalledWith(null);
  });

  it('onImportArchiveFile is a no-op when no file is selected', async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onImportArchiveFile({
        target: { files: null, value: '' },
      } as unknown as Parameters<typeof result.current.onImportArchiveFile>[0]);
    });
    expect(deps.pipeline.reset).not.toHaveBeenCalled();
  });

  it('onExportSignedJson surfaces signing errors via pipeline.setError', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('passphrase');
    const signingKey = fakeSigningKey({
      signAndDownloadFindings: vi.fn(async () => {
        throw new Error('decrypt failed');
      }),
    });
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
      signingKey,
    });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    expect(deps.pipeline.setError).toHaveBeenCalledWith(
      expect.stringMatching(/Signing failed: decrypt failed/),
    );
    promptSpy.mockRestore();
  });

  it('onExportSignedJson emits a safeAudit signed-export event with file/hash/keyId after a successful sign', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('passphrase');
    const signingKey = fakeSigningKey({
      signAndDownloadFindings: vi.fn(async () => ({
        fileName: 'Lease-findings.signed.json',
        inputHash: 'deadbeef',
        signingKeyId: 'cafef00d',
      })),
    });
    const deps = makeDeps({
      pipeline: fakePipeline({
        status: {
          kind: 'analyzed',
          fileName: 'Lease.pdf',
          result: {
            doc: { pages: [], paragraphs: [], sections: [], raw: '' },
            findings: [],
          },
          bytes: new Uint8Array([1, 2, 3]),
        },
      }),
      signingKey,
    });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    expect(deps.safeAudit).toHaveBeenCalledWith({
      kind: 'signed-export',
      payload: {
        fileName: 'Lease-findings.signed.json',
        format: 'json',
        inputHash: 'deadbeef',
        signingKeyId: 'cafef00d',
      },
    });
    expect(deps.refreshAuditLog).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('onExportSignedJson signed-export audit payload carries null inputHash + signingKeyId when unknown', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('passphrase');
    const signingKey = fakeSigningKey({
      signAndDownloadFindings: vi.fn(async () => ({
        fileName: 'L-findings.signed.json',
        inputHash: null,
        signingKeyId: null,
      })),
    });
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
      signingKey,
    });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    const call = deps.safeAudit.mock.calls.find(
      (c: unknown[]) => (c[0] as { kind?: string }).kind === 'signed-export',
    );
    expect(call?.[0]).toEqual({
      kind: 'signed-export',
      payload: {
        fileName: 'L-findings.signed.json',
        format: 'json',
        inputHash: null,
        signingKeyId: null,
      },
    });
    promptSpy.mockRestore();
  });

  it('onExportSignedJson does not emit an audit event when signing throws', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('passphrase');
    const signingKey = fakeSigningKey({
      signAndDownloadFindings: vi.fn(async () => {
        throw new Error('decrypt failed');
      }),
    });
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
      signingKey,
    });
    const { result } = renderHook(() => useAppCallbacks(deps));
    await act(async () => {
      await result.current.onExportSignedJson();
    });
    const audited = deps.safeAudit.mock.calls.some(
      (c: unknown[]) => (c[0] as { kind?: string }).kind === 'signed-export',
    );
    expect(audited).toBe(false);
    promptSpy.mockRestore();
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
