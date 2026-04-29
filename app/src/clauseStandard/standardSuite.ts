// Wave 10 Part C — "My standard" clause suite.
//
// User-curated set of clauses promoted from real leases. Stored in its own
// IndexedDB database (`leaseguard-standards`) so the lease store schema is
// untouched. Mutations write best-effort `standard-promote` /
// `standard-delete` audit entries via `appendAuditEntry`.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { appendAuditEntry } from '../audit/auditLog';

export const STANDARDS_DB_NAME = 'leaseguard-standards';
const STANDARDS_DB_VERSION = 1;
const STORE = 'standards';

export interface StandardClause {
  id: string;
  name: string;
  sourceLeaseId: string;
  sourceParagraphIndex: number;
  normalizedText: string;
  createdAt: number;
}

export interface PromoteInput {
  name: string;
  sourceLeaseId: string;
  sourceParagraphIndex: number;
  normalizedText: string;
}

interface StandardsSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: StandardClause;
  };
}

let dbPromise: Promise<IDBPDatabase<StandardsSchema>> | null = null;

export function _resetStandardsDbForTests(): void {
  if (dbPromise) {
    void dbPromise.then((db) => {
      db.close();
    });
  }
  dbPromise = null;
}

async function openStandardsDb(): Promise<IDBPDatabase<StandardsSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<StandardsSchema>(STANDARDS_DB_NAME, STANDARDS_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function randomId(): string {
  // Avoid pulling in storage.ts's randomId to keep IDB modules independent.
  // crypto.randomUUID is present in jsdom + modern browsers; fall back to a
  // timestamp-based id for very old environments.
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `std-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Audit appends must never abort the primary mutation. Mirrors App.tsx's
// `safeAudit` wrapper so calling these mutators outside of App still keeps
// the chain consistent without throwing.
async function safeAudit(kind: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await appendAuditEntry({ kind, payload });
  } catch (err) {
    console.warn('audit append failed', err);
  }
}

export async function promoteToStandard(input: PromoteInput): Promise<StandardClause> {
  const db = await openStandardsDb();
  const record: StandardClause = {
    id: randomId(),
    name: input.name,
    sourceLeaseId: input.sourceLeaseId,
    sourceParagraphIndex: input.sourceParagraphIndex,
    normalizedText: input.normalizedText,
    createdAt: Date.now(),
  };
  await db.put(STORE, record);
  await safeAudit('standard-promote', {
    standardId: record.id,
    sourceLeaseId: record.sourceLeaseId,
    sourceParagraphIndex: record.sourceParagraphIndex,
    name: record.name,
  });
  return record;
}

export async function listStandards(): Promise<StandardClause[]> {
  const db = await openStandardsDb();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteStandard(id: string): Promise<void> {
  const db = await openStandardsDb();
  await db.delete(STORE, id);
  await safeAudit('standard-delete', { standardId: id });
}
