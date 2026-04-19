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
 */
export async function bulkImport(
  files: File[],
  onEach: (result: BulkResult) => void,
  deps: BulkImportDeps,
): Promise<BulkSummary> {
  const summary: BulkSummary = { ok: 0, skipped: 0, errors: 0 };
  for (const file of files) {
    let hash = '';
    try {
      const bytes = await readFileBytes(file);
      hash = await sha256Hex(bytes);

      if (await hasSeen(hash)) {
        summary.skipped += 1;
        onEach({ fileName: file.name, hash, status: 'skipped' });
        continue;
      }

      const { doc, findings } = await deps.analyze(bytes);
      const leaseId = await deps.save({ name: file.name, doc, findings });
      await rememberHash(hash, leaseId);
      summary.ok += 1;
      onEach({ fileName: file.name, hash, status: 'ok', leaseId });
    } catch (err) {
      summary.errors += 1;
      onEach({
        fileName: file.name,
        hash,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summary;
}

async function hasSeen(hash: string): Promise<boolean> {
  const db = await openDedupDb();
  return (await db.getKey(HASH_STORE, hash)) !== undefined;
}

async function rememberHash(hash: string, leaseId: string): Promise<void> {
  const db = await openDedupDb();
  await db.put(HASH_STORE, { hash, firstSeenAt: Date.now(), leaseId });
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
