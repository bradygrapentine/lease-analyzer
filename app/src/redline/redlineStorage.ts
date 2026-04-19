import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RedlineEdit } from './redline';

// Intentionally separate from the leases DB (`leaseguard`) and the packs DB
// (`leaseguard-packs`). Redlines are a Phase 9 addition — keeping them in
// their own database means the lease-record schema never has to migrate.
const DB_NAME = 'leaseguard-redlines';
const DB_VERSION = 1;
const EDITS = 'edits';

interface RedlinesSchema extends DBSchema {
  [EDITS]: {
    // Primary key is the composite [leaseId, paragraphIndex] so callers can
    // upsert without searching an index first.
    key: [string, number];
    value: RedlineEdit;
    indexes: { 'by-lease': string };
  };
}

let dbPromise: Promise<IDBPDatabase<RedlinesSchema>> | null = null;

export function _resetRedlineDbForTests(): void {
  dbPromise = null;
}

export async function openRedlineDb(): Promise<IDBPDatabase<RedlinesSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RedlinesSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(EDITS)) {
            const store = db.createObjectStore(EDITS, {
              keyPath: ['leaseId', 'paragraphIndex'],
            });
            store.createIndex('by-lease', 'leaseId');
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function saveEdit(editValue: RedlineEdit): Promise<void> {
  const db = await openRedlineDb();
  await db.put(EDITS, editValue);
}

export async function listEditsForLease(leaseId: string): Promise<RedlineEdit[]> {
  const db = await openRedlineDb();
  const all = await db.getAllFromIndex(EDITS, 'by-lease', leaseId);
  return all.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
}

export async function deleteEdit(leaseId: string, paragraphIndex: number): Promise<void> {
  const db = await openRedlineDb();
  await db.delete(EDITS, [leaseId, paragraphIndex]);
}
