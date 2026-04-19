import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  bulkImport,
  _resetBulkDedupDbForTests,
  BULK_DEDUP_DB_NAME,
  type AnalyzeFn,
  type BulkResult,
  type SaveFn,
} from './bulkImport';

async function wipeDedup(): Promise<void> {
  _resetBulkDedupDbForTests();
  await Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(BULK_DEDUP_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

function pdfFile(name: string, bytes: Uint8Array): File {
  // Cast via ArrayBufferView to satisfy the strict `BlobPart` narrowing —
  // lib.dom's Blob ctor wants an ArrayBuffer-backed view, not the generic
  // ArrayBufferLike (which permits SharedArrayBuffer).
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
}

function fakeAnalyze(): AnalyzeFn {
  return vi.fn(async (bytes: Uint8Array) => ({
    doc: {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [{ text: `len=${bytes.length}`, page: 1 }],
      sections: [],
      raw: `len=${bytes.length}`,
    },
    findings: [],
  }));
}

function fakeSave(): SaveFn {
  let n = 0;
  return vi.fn(async () => `lease-${++n}`);
}

describe('bulkImport', () => {
  beforeEach(async () => {
    await wipeDedup();
  });

  it('analyzes and saves each unique PDF, reporting one BulkResult per file', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [
      pdfFile('a.pdf', new Uint8Array([1, 2, 3])),
      pdfFile('b.pdf', new Uint8Array([4, 5, 6])),
    ];
    const seen: BulkResult[] = [];
    const summary = await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen).toHaveLength(2);
    expect(seen.every((r) => r.status === 'ok')).toBe(true);
    expect(summary.ok).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('preserves input order in onEach callbacks', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [
      pdfFile('one.pdf', new Uint8Array([1])),
      pdfFile('two.pdf', new Uint8Array([2])),
      pdfFile('three.pdf', new Uint8Array([3])),
    ];
    const seen: BulkResult[] = [];
    await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen.map((r) => r.fileName)).toEqual(['one.pdf', 'two.pdf', 'three.pdf']);
  });

  it('deduplicates by SHA-256 hash — second upload of same bytes is skipped', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const bytes = new Uint8Array([9, 9, 9]);
    const files = [pdfFile('original.pdf', bytes), pdfFile('duplicate.pdf', bytes)];
    const seen: BulkResult[] = [];
    const summary = await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(summary.ok).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(seen[0]?.status).toBe('ok');
    expect(seen[1]?.status).toBe('skipped');
    expect(seen[0]?.hash).toBe(seen[1]?.hash);
    // analyze should only have run once.
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('skips a PDF whose hash was seen on a previous invocation', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const bytes = new Uint8Array([42, 42]);
    await bulkImport([pdfFile('first.pdf', bytes)], () => {}, { analyze, save });
    const seen: BulkResult[] = [];
    await bulkImport([pdfFile('again.pdf', bytes)], (r) => seen.push(r), {
      analyze,
      save,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.status).toBe('skipped');
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('records analyze errors without aborting the batch', async () => {
    const analyze: AnalyzeFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce({
        doc: {
          pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
          paragraphs: [],
          sections: [],
          raw: '',
        },
        findings: [],
      });
    const save = fakeSave();
    const files = [
      pdfFile('broken.pdf', new Uint8Array([1])),
      pdfFile('ok.pdf', new Uint8Array([2])),
    ];
    const seen: BulkResult[] = [];
    const summary = await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.status).toBe('error');
    expect(seen[0]?.error).toMatch(/parse failed/);
    expect(seen[1]?.status).toBe('ok');
    expect(summary.errors).toBe(1);
    expect(summary.ok).toBe(1);
  });

  it('records save errors and continues', async () => {
    const analyze = fakeAnalyze();
    const save: SaveFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('db full'))
      .mockResolvedValueOnce('lease-2');
    const files = [
      pdfFile('savefail.pdf', new Uint8Array([1])),
      pdfFile('saveok.pdf', new Uint8Array([2])),
    ];
    const seen: BulkResult[] = [];
    const summary = await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.status).toBe('error');
    expect(seen[0]?.error).toMatch(/db full/);
    expect(summary.ok).toBe(1);
    expect(summary.errors).toBe(1);
  });

  it('assigns a leaseId on successful import', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [pdfFile('a.pdf', new Uint8Array([1, 2, 3]))];
    const seen: BulkResult[] = [];
    await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.leaseId).toBe('lease-1');
  });

  it('returns hex-lowercase hashes of 64 chars (SHA-256)', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [pdfFile('a.pdf', new Uint8Array([1, 2, 3]))];
    const seen: BulkResult[] = [];
    await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different file contents produce different hashes', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [
      pdfFile('a.pdf', new Uint8Array([1])),
      pdfFile('b.pdf', new Uint8Array([2])),
    ];
    const seen: BulkResult[] = [];
    await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.hash).not.toBe(seen[1]?.hash);
  });
});
