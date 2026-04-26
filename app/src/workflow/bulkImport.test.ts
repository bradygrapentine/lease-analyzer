import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  bulkImport,
  _resetBulkDedupDbForTests,
  BULK_DEDUP_DB_NAME,
  type AnalyzeFn,
  type BulkResult,
  type SaveFn,
} from './bulkImport';
import { buildStoreZip } from './storeZip';

async function wipeDedup(): Promise<void> {
  // `_resetBulkDedupDbForTests` fires close() off the cached handle but
  // doesn't await it. In parallel-file runs, a pending `db.put` from the
  // previous test's `rememberHash` can race the delete and throw
  // InvalidStateError at the top-level unhandled-rejection handler.
  //
  // Drain by explicitly opening + closing the cached handle before we
  // reset, then yield twice so fake-indexeddb's internal "close queue"
  // flushes before `deleteDatabase` takes the lock.
  _resetBulkDedupDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => setTimeout(r, 0));
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

  describe('zip input', () => {
    function zipFile(name: string, entries: { name: string; data: Uint8Array }[]): File {
      const bytes = buildStoreZip(entries);
      const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
      return new File([blob], name, { type: 'application/zip' });
    }

    it('walks a STORE zip and reports one BulkResult per top-level PDF entry', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = zipFile('batch.zip', [
        { name: 'lease-a.pdf', data: new Uint8Array([1, 2, 3]) },
        { name: 'lease-b.pdf', data: new Uint8Array([4, 5, 6]) },
      ]);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([z], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(2);
      expect(seen.map((r) => r.fileName)).toEqual([
        'batch.zip/lease-a.pdf',
        'batch.zip/lease-b.pdf',
      ]);
      expect(summary.ok).toBe(2);
    });

    it('skips non-PDF entries and nested-folder entries', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = zipFile('batch.zip', [
        { name: 'README.txt', data: new Uint8Array([0xff]) },
        { name: 'sub/inside.pdf', data: new Uint8Array([7, 7, 7]) },
        { name: 'top.pdf', data: new Uint8Array([8, 8, 8]) },
      ]);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([z], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.fileName).toBe('batch.zip/top.pdf');
      expect(summary.ok).toBe(1);
    });

    it('dedupes a zip entry whose hash matches an already-imported lease, imports a fresh entry, and surfaces a per-entry error for a corrupted entry without aborting', async () => {
      const analyze: AnalyzeFn = vi.fn(async (bytes: Uint8Array) => {
        // Treat any payload that starts with 0x00 0x00 0x00 as "corrupt".
        if (bytes.length >= 3 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0) {
          throw new Error('parse failed: corrupted PDF');
        }
        return {
          doc: {
            pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
            paragraphs: [{ text: `len=${bytes.length}`, page: 1 }],
            sections: [],
            raw: `len=${bytes.length}`,
          },
          findings: [],
        };
      });
      const save = fakeSave();
      const dupBytes = new Uint8Array([11, 22, 33]);

      // Pre-seed the dedup store by importing the dup as a standalone PDF.
      const seedFile = pdfFile('seed.pdf', dupBytes);
      await bulkImport([seedFile], () => {}, { analyze, save });

      const z = zipFile('batch.zip', [
        { name: 'dup.pdf', data: dupBytes },
        { name: 'fresh.pdf', data: new Uint8Array([99, 100, 101]) },
        { name: 'broken.pdf', data: new Uint8Array([0, 0, 0, 1]) },
      ]);

      const seen: BulkResult[] = [];
      const summary = await bulkImport([z], (r) => seen.push(r), { analyze, save });

      expect(seen).toHaveLength(3);
      expect(seen[0]).toMatchObject({ fileName: 'batch.zip/dup.pdf', status: 'skipped' });
      expect(seen[1]).toMatchObject({ fileName: 'batch.zip/fresh.pdf', status: 'ok' });
      expect(seen[2]?.fileName).toBe('batch.zip/broken.pdf');
      expect(seen[2]?.status).toBe('error');
      expect(seen[2]?.error).toMatch(/corrupted PDF/);

      expect(summary).toEqual({ ok: 1, skipped: 1, errors: 1 });
    });

    it('surfaces a single batch-level error if the zip itself is malformed', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/zip' });
      const broken = new File([blob], 'broken.zip', { type: 'application/zip' });
      const seen: BulkResult[] = [];
      const summary = await bulkImport([broken], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('error');
      expect(summary.errors).toBe(1);
    });

    it('detects zip by .zip extension even when File.type is empty', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const bytes = buildStoreZip([{ name: 'a.pdf', data: new Uint8Array([1]) }]);
      const blob = new Blob([bytes as BlobPart]);
      const file = new File([blob], 'no-mime.zip', { type: '' });
      const seen: BulkResult[] = [];
      await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.fileName).toBe('no-mime.zip/a.pdf');
    });
  });

  it('different file contents produce different hashes', async () => {
    const analyze = fakeAnalyze();
    const save = fakeSave();
    const files = [pdfFile('a.pdf', new Uint8Array([1])), pdfFile('b.pdf', new Uint8Array([2]))];
    const seen: BulkResult[] = [];
    await bulkImport(files, (r) => seen.push(r), { analyze, save });
    expect(seen[0]?.hash).not.toBe(seen[1]?.hash);
  });
});
