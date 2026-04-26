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

    // ---- Hardening helpers ----
    // The ZIP layout produced by `buildStoreZip` is deterministic:
    //   [LFH(30) + name + data] * N  +  [CDH(46) + name] * N  +  EOCD(22)
    // No extras, no comments. We exploit that to patch specific bytes
    // (CRC, GP-flag, method, sizes) without re-implementing the writer.
    function locateCdh(bytes: Uint8Array, entryIndex: number): number {
      // Walk LFHs to find where the central directory starts.
      let cursor = 0;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      // EOCD has cdOffset at len-22+16
      const eocd = bytes.length - 22;
      const cdStart = dv.getUint32(eocd + 16, true);
      cursor = cdStart;
      for (let i = 0; i < entryIndex; i++) {
        const nameLen = dv.getUint16(cursor + 28, true);
        const extraLen = dv.getUint16(cursor + 30, true);
        const commentLen = dv.getUint16(cursor + 32, true);
        cursor += 46 + nameLen + extraLen + commentLen;
      }
      return cursor;
    }
    function patchU32(bytes: Uint8Array, offset: number, value: number): void {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      dv.setUint32(offset, value, true);
    }
    function patchU16(bytes: Uint8Array, offset: number, value: number): void {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      dv.setUint16(offset, value, true);
    }
    function fileFromBytes(name: string, bytes: Uint8Array): File {
      const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
      return new File([blob], name, { type: 'application/zip' });
    }

    it('surfaces a per-entry crc-mismatch error and continues with other entries', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([
        { name: 'bad.pdf', data: new Uint8Array([1, 2, 3, 4]) },
        { name: 'good.pdf', data: new Uint8Array([5, 6, 7, 8]) },
      ]);
      // Corrupt the CRC32 field (offset 16 in the CDH) of the first entry.
      const cdh0 = locateCdh(z, 0);
      patchU32(z, cdh0 + 16, 0xdeadbeef);
      const file = fileFromBytes('mixed.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(2);
      expect(seen[0]?.fileName).toBe('mixed.zip/bad.pdf');
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/crc-mismatch/);
      expect(seen[1]?.fileName).toBe('mixed.zip/good.pdf');
      expect(seen[1]?.status).toBe('ok');
      expect(summary).toEqual({ ok: 1, skipped: 0, errors: 1 });
    });

    it('rejects ZIP64 archives explicitly when an entry size carries the ZIP64 marker', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([{ name: 'big.pdf', data: new Uint8Array([1, 2, 3]) }]);
      // Patch CDH compressed-size (offset 20) to the ZIP64 marker.
      const cdh0 = locateCdh(z, 0);
      patchU32(z, cdh0 + 20, 0xffffffff);
      const file = fileFromBytes('zip64.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/ZIP64/);
      expect(seen[0]?.error).toMatch(/split and re-zip/);
      expect(summary.errors).toBe(1);
    });

    it('surfaces a per-entry encrypted-entry error without aborting the batch', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([
        { name: 'locked.pdf', data: new Uint8Array([1, 2, 3]) },
        { name: 'open.pdf', data: new Uint8Array([4, 5, 6]) },
      ]);
      // Set bit 0 of the GP-flag in the first CDH (offset 8).
      const cdh0 = locateCdh(z, 0);
      patchU16(z, cdh0 + 8, 0x0001);
      const file = fileFromBytes('mixed.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(2);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/encrypted-entry/);
      expect(seen[1]?.status).toBe('ok');
      expect(summary).toEqual({ ok: 1, skipped: 0, errors: 1 });
    });

    it('surfaces a per-entry unsupported-compression error for non-STORE/non-DEFLATE methods', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([
        { name: 'bz.pdf', data: new Uint8Array([1, 2, 3]) },
        { name: 'plain.pdf', data: new Uint8Array([4, 5, 6]) },
      ]);
      // Patch method (offset 10 in CDH) to 12 (BZIP2).
      const cdh0 = locateCdh(z, 0);
      patchU16(z, cdh0 + 10, 12);
      const file = fileFromBytes('mixed.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(2);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/unsupported-compression/);
      expect(seen[0]?.error).toMatch(/method 12/);
      expect(seen[1]?.status).toBe('ok');
      expect(summary).toEqual({ ok: 1, skipped: 0, errors: 1 });
    });

    it('inflates a DEFLATE-compressed entry via DecompressionStream', async () => {
      // Build a minimal zip by hand with a single DEFLATE entry. We
      // round-trip through the platform's CompressionStream so we don't
      // ship a deflate encoder.
      const enc = new TextEncoder();
      const payload = enc.encode('hello hello hello hello hello hello world');
      const Compressor = (
        globalThis as unknown as {
          CompressionStream: new (format: string) => {
            readable: ReadableStream<Uint8Array>;
            writable: WritableStream<Uint8Array>;
          };
        }
      ).CompressionStream;
      const cs = new Compressor('deflate-raw');
      const w = cs.writable.getWriter();
      void w.write(payload);
      void w.close();
      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.length;
        }
      }
      const compressed = new Uint8Array(total);
      let p = 0;
      for (const c of chunks) {
        compressed.set(c, p);
        p += c.length;
      }
      // CRC32 of the *uncompressed* payload.
      const crc = ((): number => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          t[i] = c >>> 0;
        }
        let c = 0xffffffff;
        for (let i = 0; i < payload.length; i++)
          c = (t[(c ^ payload[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
        return (c ^ 0xffffffff) >>> 0;
      })();

      const name = enc.encode('a.pdf');
      const lfhSize = 30 + name.length + compressed.length;
      const cdhSize = 46 + name.length;
      const totalSize = lfhSize + cdhSize + 22;
      const z = new Uint8Array(totalSize);
      const dv = new DataView(z.buffer);
      // LFH
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 8, true); // method = DEFLATE
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, compressed.length, true);
      dv.setUint32(22, payload.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      z.set(name, 30);
      z.set(compressed, 30 + name.length);
      // CDH
      const cdOff = lfhSize;
      dv.setUint32(cdOff, 0x02014b50, true);
      dv.setUint16(cdOff + 4, 20, true);
      dv.setUint16(cdOff + 6, 20, true);
      dv.setUint16(cdOff + 8, 0, true);
      dv.setUint16(cdOff + 10, 8, true); // DEFLATE
      dv.setUint16(cdOff + 12, 0, true);
      dv.setUint16(cdOff + 14, 0x21, true);
      dv.setUint32(cdOff + 16, crc, true);
      dv.setUint32(cdOff + 20, compressed.length, true);
      dv.setUint32(cdOff + 24, payload.length, true);
      dv.setUint16(cdOff + 28, name.length, true);
      dv.setUint16(cdOff + 30, 0, true);
      dv.setUint16(cdOff + 32, 0, true);
      dv.setUint16(cdOff + 34, 0, true);
      dv.setUint16(cdOff + 36, 0, true);
      dv.setUint32(cdOff + 38, 0, true);
      dv.setUint32(cdOff + 42, 0, true); // LFH offset
      z.set(name, cdOff + 46);
      // EOCD
      const eocd = cdOff + cdhSize;
      dv.setUint32(eocd, 0x06054b50, true);
      dv.setUint16(eocd + 4, 0, true);
      dv.setUint16(eocd + 6, 0, true);
      dv.setUint16(eocd + 8, 1, true);
      dv.setUint16(eocd + 10, 1, true);
      dv.setUint32(eocd + 12, cdhSize, true);
      dv.setUint32(eocd + 16, cdOff, true);
      dv.setUint16(eocd + 20, 0, true);

      const analyze = vi.fn(async (bytes: Uint8Array) => ({
        doc: {
          pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
          paragraphs: [{ text: `len=${bytes.length}`, page: 1 }],
          sections: [],
          raw: `len=${bytes.length}`,
        },
        findings: [],
      }));
      const save = fakeSave();
      const file = fileFromBytes('deflate.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('ok');
      // analyze received the inflated payload.
      const passed = analyze.mock.calls[0]?.[0] as Uint8Array;
      expect(passed.length).toBe(payload.length);
      expect(summary.ok).toBe(1);
    });

    it('rejects a zip whose ZIP64 EOCD locator sits before the EOCD', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([{ name: 'a.pdf', data: new Uint8Array([1, 2, 3]) }]);
      // Splice the 20-byte ZIP64 locator (signature only matters for our
      // detector) just before the EOCD.
      const eocdStart = z.length - 22;
      const out = new Uint8Array(z.length + 20);
      out.set(z.subarray(0, eocdStart), 0);
      const dv = new DataView(out.buffer);
      dv.setUint32(eocdStart, 0x07064b50, true); // ZIP64 EOCD locator sig
      out.set(z.subarray(eocdStart), eocdStart + 20);
      const file = fileFromBytes('zip64-loc.zip', out);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/ZIP64/);
      expect(summary.errors).toBe(1);
    });

    it('surfaces an error if a local file header is missing for an entry', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([{ name: 'a.pdf', data: new Uint8Array([1, 2, 3]) }]);
      // Trash the LFH signature at offset 0.
      const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
      dv.setUint32(0, 0xdeadbeef, true);
      const file = fileFromBytes('no-lfh.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/local header missing/);
      expect(summary.errors).toBe(1);
    });

    it('throws on a corrupt central-directory entry signature', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = buildStoreZip([
        { name: 'a.pdf', data: new Uint8Array([1, 2, 3]) },
        { name: 'b.pdf', data: new Uint8Array([4, 5, 6]) },
      ]);
      // Corrupt the second CDH entry's signature.
      const cdh1 = locateCdh(z, 1);
      patchU32(z, cdh1, 0xdeadbeef);
      const file = fileFromBytes('bad-cdh.zip', z);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([file], (r) => seen.push(r), { analyze, save });
      // parseZipEntries throws -> single archive-level error event.
      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('error');
      expect(seen[0]?.error).toMatch(/central directory entry corrupt/);
      expect(summary.errors).toBe(1);
    });

    it('silently skips __MACOSX/*, .DS_Store, and bare directory entries (zero events for them)', async () => {
      const analyze = fakeAnalyze();
      const save = fakeSave();
      const z = zipFile('noise.zip', [
        { name: '__MACOSX/foo.pdf', data: new Uint8Array([1]) },
        { name: '.DS_Store', data: new Uint8Array([2]) },
        { name: 'subdir/', data: new Uint8Array([]) },
        { name: 'real.pdf', data: new Uint8Array([3, 4, 5]) },
      ]);
      const seen: BulkResult[] = [];
      const summary = await bulkImport([z], (r) => seen.push(r), { analyze, save });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.fileName).toBe('noise.zip/real.pdf');
      expect(summary).toEqual({ ok: 1, skipped: 0, errors: 0 });
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
