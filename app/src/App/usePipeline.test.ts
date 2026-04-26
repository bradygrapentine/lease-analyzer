import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
vi.mock('../ocr/runOcr', () => ({
  runOcr: vi.fn(async (_bytes: Uint8Array) => ({
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [
      { page: 1, text: 'Any dispute shall be resolved by binding arbitration, not court.' },
    ],
    sections: [],
    raw: '',
  })),
}));
import { usePipeline } from './usePipeline';
import { makePdf } from '../parser/testFixtures';
import {
  _resetDbForTests,
  getStandardId,
  openLeaseDb,
  setStandardId,
  saveLease,
  listLeases,
} from '../storage/storage';

beforeEach(async () => {
  try {
    const db = await openLeaseDb();
    db.close();
  } catch {
    // ignore
  }
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

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

describe('usePipeline', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => usePipeline());
    expect(result.current.status.kind).toBe('idle');
    expect(result.current.ocrState.kind).toBe('idle');
    expect(result.current.comparison).toBeNull();
  });

  it('upload transitions idle → analyzed and calls onLibraryChange', async () => {
    const onLibraryChange = vi.fn();
    const { result } = renderHook(() => usePipeline({ onLibraryChange }));
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'pipe.pdf');
    });
    expect(result.current.status.kind).toBe('analyzed');
    if (result.current.status.kind === 'analyzed') {
      expect(result.current.status.fileName).toBe('pipe.pdf');
      expect(result.current.status.result.findings.length).toBeGreaterThan(0);
    }
    expect(onLibraryChange).toHaveBeenCalled();
    expect((await listLeases()).length).toBe(1);
  });

  it('upload produces an error status on malformed bytes', async () => {
    const { result } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.upload(new Uint8Array([1, 2, 3]), 'bad.pdf');
    });
    expect(result.current.status.kind).toBe('error');
  });

  it('auto-compares against the standard when one is set', async () => {
    // Seed a standard lease directly through storage.
    const std = await saveLease({
      name: 'Standard.pdf',
      doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      findings: [],
    });
    await setStandardId(std);

    const { result } = renderHook(() => usePipeline());
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'New.pdf');
    });
    await waitFor(() => expect(result.current.comparison).not.toBeNull());
    expect(await getStandardId()).toBe(std);
  });

  it('ocr() is a no-op when not in analyzed state', async () => {
    const { result } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.ocr();
    });
    expect(result.current.ocrState.kind).toBe('idle');
    expect(result.current.status.kind).toBe('idle');
  });

  it('ocr() replaces findings when analyzed with bytes', async () => {
    const { result } = renderHook(() => usePipeline());
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'scan.pdf');
    });
    expect(result.current.status.kind).toBe('analyzed');
    await act(async () => {
      await result.current.ocr();
    });
    expect(result.current.ocrState.kind).toBe('idle');
    if (result.current.status.kind === 'analyzed') {
      // OCR mock injects a mandatory-arbitration paragraph, so we expect a
      // rule match for it in the replaced findings list.
      const titles = result.current.status.result.findings.map((f) => f.title).join(' ');
      expect(titles.toLowerCase()).toMatch(/arbitration/);
    }
  });

  it('ocr() falls back to deterministic-only when Phase 18 flag is off', async () => {
    // Wave 23-B regression check: with the flag default-off, the audit
    // callback never fires (no llm-classify entries) and the result
    // shape matches the deterministic-only path.
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePipeline({ audit }));
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'lease.pdf');
    });
    await act(async () => {
      await result.current.ocr();
    });
    // No llm-classify entries when flag is off (the only kind audit
    // would receive from the OCR path is llm-classify; analyze /
    // save-lease are wired elsewhere).
    const llmClassifyCalls = audit.mock.calls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => c[0]?.kind === 'llm-classify',
    );
    expect(llmClassifyCalls).toHaveLength(0);
  });

  it('ocr() falls back gracefully when loadClassifier throws', async () => {
    // Force the flag on for this test, then expect the inner load to
    // fail (jsdom can't run @xenova/transformers) and the pipeline to
    // still complete with deterministic findings.
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?phase18=on'),
      writable: true,
    });
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePipeline({ audit }));
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'lease.pdf');
    });
    await act(async () => {
      await result.current.ocr();
    });
    // Status reaches 'analyzed' regardless of classifier load failure.
    expect(result.current.status.kind).toBe('analyzed');
    // Restore.
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/'),
      writable: true,
    });
  });

  it('open() sets status to analyzed from a LeaseRecord', async () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.open({
        id: 'x',
        name: 'From lib.pdf',
        createdAt: 0,
        updatedAt: 0,
        rulePackVersion: '1.0.0',
        pageCount: 0,
        findingCount: 0,
        doc: { pages: [], paragraphs: [], sections: [], raw: '' },
        findings: [],
      });
    });
    if (result.current.status.kind !== 'analyzed') throw new Error('expected analyzed');
    expect(result.current.status.fileName).toBe('From lib.pdf');
    expect(result.current.status.bytes).toBeNull();
  });

  it('reset() returns to idle and clears comparison', async () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.setComparison({
        a: {
          id: 'a',
          name: 'A',
          createdAt: 0,
          updatedAt: 0,
          rulePackVersion: '1',
          pageCount: 0,
          findingCount: 0,
          doc: { pages: [], paragraphs: [], sections: [], raw: '' },
          findings: [],
        },
        b: {
          id: 'b',
          name: 'B',
          createdAt: 0,
          updatedAt: 0,
          rulePackVersion: '1',
          pageCount: 0,
          findingCount: 0,
          doc: { pages: [], paragraphs: [], sections: [], raw: '' },
          findings: [],
        },
      });
    });
    expect(result.current.comparison).not.toBeNull();
    act(() => {
      result.current.reset();
    });
    expect(result.current.comparison).toBeNull();
    expect(result.current.status.kind).toBe('idle');
  });

  it('reanalyze() is a no-op when not in analyzed state', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.reanalyze();
    });
    expect(result.current.status.kind).toBe('idle');
  });

  it('reanalyze() re-runs rules over the current doc with current rules', async () => {
    // Start with an empty rule set — no findings after upload.
    const { result, rerender } = renderHook(
      (props: { rules: import('../rules/types').Rule[] }) => usePipeline({ rules: props.rules }),
      { initialProps: { rules: [] as import('../rules/types').Rule[] } },
    );
    const bytes = await makeBytes();
    await act(async () => {
      await result.current.upload(bytes, 'reanalyze.pdf');
    });
    if (result.current.status.kind !== 'analyzed') throw new Error('expected analyzed');
    expect(result.current.status.result.findings.length).toBe(0);

    // Swap in a rule that matches the fixture — reanalyze should pick it up
    // without re-parsing the PDF.
    const rule: import('../rules/types').Rule = {
      id: 'test-renew',
      severity: 'low',
      category: 'general',
      title: 'Renewal mention',
      explanation: 'The lease mentions renewal.',
      citation: null,
      match: { type: 'regex', pattern: 'auto-renew', flags: 'i' },
    };
    rerender({ rules: [rule] });
    act(() => {
      result.current.reanalyze();
    });
    if (result.current.status.kind !== 'analyzed') throw new Error('expected analyzed');
    expect(result.current.status.result.findings.length).toBeGreaterThan(0);
    expect(result.current.status.result.findings[0]?.ruleId).toBe('test-renew');
  });

  it('setError() pushes an error status', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.setError('boom');
    });
    if (result.current.status.kind !== 'error') throw new Error('expected error');
    expect(result.current.status.message).toBe('boom');
  });

  it('routes upload() through an injected pipelineClient (Phase 13 worker hook)', async () => {
    const doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    const parseAndAnalyze = vi.fn(async () => ({ doc, findings: [] }));
    const pipelineClient = { parseAndAnalyze, terminate: vi.fn() };
    const { result } = renderHook(() => usePipeline({ pipelineClient }));
    const bytes = new Uint8Array([1, 2, 3]);
    await act(async () => {
      await result.current.upload(bytes, 'stub.pdf');
    });
    expect(parseAndAnalyze).toHaveBeenCalledTimes(1);
    // Hook must transition to analyzed using the stub's output.
    if (result.current.status.kind !== 'analyzed') throw new Error('expected analyzed');
    expect(result.current.status.result.doc).toBe(doc);
    expect(result.current.status.result.findings).toEqual([]);
  });
});
