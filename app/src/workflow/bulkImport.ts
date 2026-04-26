import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import { sha256Hex } from '../security/inputHash';

/**
 * Bulk PDF import with per-file progress and content-hash dedup.
 *
 * Dedup lives in its OWN IndexedDB (`leaseguard-bulk-dedup`) so we never
 * touch the main `leaseguard` schema — adding a column there is not in
 * scope for this phase. The dedup store records only `{hash, firstSeenAt,
 * leaseId}` and is append-only from this module's perspective.
 *
 * Caller injects `analyze` + `save` so the function stays pure-ish and is
 * trivially unit-testable without booting the parser.
 */

export const BULK_DEDUP_DB_NAME = 'leaseguard-bulk-dedup';
const BULK_DEDUP_DB_VERSION = 1;
const HASH_STORE = 'hashes';

interface DedupSchema extends DBSchema {
  [HASH_STORE]: {
    key: string;
    value: { hash: string; firstSeenAt: number; leaseId: string };
  };
}

let dedupDbPromise: Promise<IDBPDatabase<DedupSchema>> | null = null;

export function _resetBulkDedupDbForTests(): void {
  if (dedupDbPromise) {
    // Fire-and-forget close so `deleteDatabase` doesn't stall on an open
    // connection. The promise resolves fast enough that the test's
    // `onblocked` fallback never fires in practice.
    dedupDbPromise.then((db) => db.close()).catch(() => {});
  }
  dedupDbPromise = null;
}

async function openDedupDb(): Promise<IDBPDatabase<DedupSchema>> {
  if (!dedupDbPromise) {
    dedupDbPromise = openDB<DedupSchema>(BULK_DEDUP_DB_NAME, BULK_DEDUP_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(HASH_STORE)) {
          db.createObjectStore(HASH_STORE, { keyPath: 'hash' });
        }
      },
    });
  }
  return dedupDbPromise;
}

export interface AnalysisResult {
  doc: LeaseDocument;
  findings: Finding[];
}

export type AnalyzeFn = (bytes: Uint8Array) => Promise<AnalysisResult>;

export interface SaveLeaseInput {
  name: string;
  doc: LeaseDocument;
  findings: Finding[];
}

export type SaveFn = (input: SaveLeaseInput) => Promise<string>;

export type BulkStatus = 'ok' | 'skipped' | 'error';

export interface BulkResult {
  fileName: string;
  hash: string;
  status: BulkStatus;
  /** Populated when status === 'ok'. */
  leaseId?: string;
  /** Populated when status === 'error'. */
  error?: string;
}

export interface BulkSummary {
  ok: number;
  skipped: number;
  errors: number;
}

export interface BulkImportDeps {
  analyze: AnalyzeFn;
  save: SaveFn;
}

/**
 * Process `files` sequentially, invoking `onEach` once per file (in input
 * order) with a `BulkResult`. Returns an aggregate summary. Errors on a
 * single file are captured on that file's `BulkResult` — we never abort
 * the batch, because the caller (a progress UI) needs a full roster.
 *
 * `.zip` inputs are walked in-memory: each top-level PDF entry yields its
 * own `BulkResult` (carrying the synthetic `<zip>/<entry>` filename) and
 * participates in dedup exactly like a directly-picked PDF. Nested folders
 * are intentionally ignored (out of scope per Wave 13-D plan); the entry
 * name is reported in the per-entry result instead. Per-entry decode or
 * analyze failures surface as `'error'` rows without aborting the batch.
 */
export async function bulkImport(
  files: File[],
  onEach: (result: BulkResult) => void,
  deps: BulkImportDeps,
): Promise<BulkSummary> {
  const summary: BulkSummary = { ok: 0, skipped: 0, errors: 0 };
  for (const file of files) {
    if (isZipFile(file)) {
      await processZip(file, onEach, deps, summary);
      continue;
    }
    await processOnePdf(file.name, file, null, onEach, deps, summary);
  }
  return summary;
}

function isZipFile(file: File): boolean {
  // MIME types for zip vary across browsers/OSes (`application/zip`,
  // `application/x-zip-compressed`, sometimes empty). Fall back to the
  // suffix on the user-visible filename, which is what the file picker
  // already filters on.
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    return true;
  }
  return file.name.toLowerCase().endsWith('.zip');
}

async function processZip(
  zipFile: File,
  onEach: (result: BulkResult) => void,
  deps: BulkImportDeps,
  summary: BulkSummary,
): Promise<void> {
  let entries: ZipEntry[];
  try {
    const bytes = await readFileBytes(zipFile);
    entries = parseZipEntries(bytes);
  } catch (err) {
    summary.errors += 1;
    onEach({
      fileName: zipFile.name,
      hash: '',
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  for (const entry of entries) {
    // Top-level only: skip anything that lives inside a directory and skip
    // the directory entries themselves. The plan defers nested layouts.
    if (entry.name.includes('/') || entry.name.endsWith('\\')) continue;
    if (!entry.name.toLowerCase().endsWith('.pdf')) continue;

    const reportedName = `${zipFile.name}/${entry.name}`;
    await processOnePdf(reportedName, null, entry, onEach, deps, summary);
  }
}

async function processOnePdf(
  reportedName: string,
  file: File | null,
  entry: ZipEntry | null,
  onEach: (result: BulkResult) => void,
  deps: BulkImportDeps,
  summary: BulkSummary,
): Promise<void> {
  let hash = '';
  try {
    const bytes = file ? await readFileBytes(file) : await decodeZipEntry(entry as ZipEntry);
    hash = await sha256Hex(bytes);

    if (await hasSeen(hash)) {
      summary.skipped += 1;
      onEach({ fileName: reportedName, hash, status: 'skipped' });
      return;
    }

    const { doc, findings } = await deps.analyze(bytes);
    const leaseId = await deps.save({ name: reportedName, doc, findings });
    await rememberHash(hash, leaseId);
    summary.ok += 1;
    onEach({ fileName: reportedName, hash, status: 'ok', leaseId });
  } catch (err) {
    summary.errors += 1;
    onEach({
      fileName: reportedName,
      hash,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function hasSeen(hash: string): Promise<boolean> {
  const db = await openDedupDb();
  return (await db.getKey(HASH_STORE, hash)) !== undefined;
}

async function rememberHash(hash: string, leaseId: string): Promise<void> {
  const db = await openDedupDb();
  await db.put(HASH_STORE, { hash, firstSeenAt: Date.now(), leaseId });
}

/**
 * Minimal ZIP reader: walks the End-of-Central-Directory + Central
 * Directory and returns one descriptor per entry. Supports STORE (method
 * 0) and DEFLATE (method 8) — the only two methods produced by every
 * mainstream zipper, including macOS Finder, Windows "Send to compressed
 * folder", and `zip(1)`. Unsupported methods surface as a per-entry
 * decode error and do not abort the batch.
 *
 * The reader is hand-rolled to avoid pulling a runtime dep into the
 * bundle budget; DEFLATE inflation uses the platform's built-in
 * `DecompressionStream('deflate-raw')` (available in modern browsers and
 * Node 18+ — no polyfill needed under jsdom + Node test env).
 *
 * Out of scope per Wave 13-D plan: ZIP64, password-protected entries,
 * data descriptors with unknown sizes (rejected with a clear error).
 */
interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  source: Uint8Array;
}

const SIG_LFH_R = 0x04034b50;
const SIG_CDH_R = 0x02014b50;
const SIG_EOCD_R = 0x06054b50;

function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) throw new Error('zip too small');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // EOCD lives in the last 22..(22+65535) bytes; scan backwards for the
  // signature. The 22-byte minimum assumes no archive comment, which is
  // the common case; we scan up to 65557 bytes total.
  const minEocd = 22;
  const maxScan = Math.min(bytes.length, 22 + 0xffff);
  let eocdOffset = -1;
  for (let i = bytes.length - minEocd; i >= bytes.length - maxScan && i >= 0; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD_R) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('zip end-of-central-directory not found');

  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  const cdSize = dv.getUint32(eocdOffset + 12, true);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);
  if (cdOffset + cdSize > bytes.length) throw new Error('zip central directory truncated');

  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(cursor, true) !== SIG_CDH_R) {
      throw new Error('zip central directory entry corrupt');
    }
    const flags = dv.getUint16(cursor + 8, true);
    const method = dv.getUint16(cursor + 10, true);
    const compressedSize = dv.getUint32(cursor + 20, true);
    const uncompressedSize = dv.getUint32(cursor + 24, true);
    const nameLen = dv.getUint16(cursor + 28, true);
    const extraLen = dv.getUint16(cursor + 30, true);
    const commentLen = dv.getUint16(cursor + 32, true);
    const localHeaderOffset = dv.getUint32(cursor + 42, true);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);

    if ((flags & 0x0001) !== 0) {
      throw new Error(`zip entry "${name}" is encrypted`);
    }

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      source: bytes,
    });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function decodeZipEntry(entry: ZipEntry): Promise<Uint8Array> {
  const bytes = entry.source;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lfh = entry.localHeaderOffset;
  if (dv.getUint32(lfh, true) !== SIG_LFH_R) {
    throw new Error(`zip entry "${entry.name}" local header missing`);
  }
  const nameLen = dv.getUint16(lfh + 26, true);
  const extraLen = dv.getUint16(lfh + 28, true);
  const dataStart = lfh + 30 + nameLen + extraLen;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) {
    // STORE: payload is the file as-is. Copy out so the slice is
    // independent of the source zip buffer (parser layer transfers it).
    return compressed.slice();
  }
  if (entry.method === 8) {
    // DEFLATE: use built-in DecompressionStream. `deflate-raw` matches
    // the no-zlib-header framing zip stores.
    return await inflateRaw(compressed);
  }
  throw new Error(`zip entry "${entry.name}" uses unsupported method ${entry.method}`);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // `DecompressionStream` exists in modern browsers + Node 18+. Fail
  // loudly if a runtime ever lacks it — better than silently misreading.
  const Ctor = (
    globalThis as unknown as {
      DecompressionStream?: new (format: string) => unknown;
    }
  ).DecompressionStream;
  if (!Ctor) throw new Error('DecompressionStream unavailable in this runtime');

  const stream = new (Ctor as new (format: string) => {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  })('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(data);
  void writer.close();

  const reader = stream.readable.getReader();
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
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error('unexpected FileReader result'));
    };
    reader.onerror = (): void => reject(reader.error ?? new Error('file read failed'));
    reader.readAsArrayBuffer(file);
  });
}
