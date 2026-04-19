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
      (props: { rules: import('../rules/types').Rule[] }) =>
        usePipeline({ rules: props.rules }),
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
});
