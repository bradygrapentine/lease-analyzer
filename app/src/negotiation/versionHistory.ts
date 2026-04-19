import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RedlineEdit } from '../redline/redline';

// Phase 9 version history. Intentionally lives in its OWN IndexedDB
// database — the lease record schema (`leaseguard`) stays v3, and the
// redline store (`leaseguard-redlines`) keeps its single-edit-per-paragraph
// contract. Each saved "version" is an immutable snapshot of the edits
// array at the moment of save.
const DB_NAME = 'leaseguard-versions';
const DB_VERSION = 1;
const VERSIONS = 'versions';
const BY_LEASE = 'by-lease';

export interface LeaseVersion {
  versionId: string;
  leaseId: string;
  createdAt: string; // ISO-8601
  label?: string;
  edits: RedlineEdit[];
  note?: string;
}

interface VersionsSchema extends DBSchema {
  [VERSIONS]: {
    key: string;
    value: LeaseVersion;
    indexes: { [BY_LEASE]: string };
  };
}

let dbPromise: Promise<IDBPDatabase<VersionsSchema>> | null = null;

export function _resetVersionsDbForTests(): void {
  dbPromise = null;
}

export async function openVersionsDb(): Promise<IDBPDatabase<VersionsSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<VersionsSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(VERSIONS)) {
            const store = db.createObjectStore(VERSIONS, {
              keyPath: 'versionId',
            });
            store.createIndex(BY_LEASE, 'leaseId');
          }
        }
      },
    });
  }
  return dbPromise;
}

export interface SaveVersionInput {
  leaseId: string;
  edits: RedlineEdit[];
  label?: string;
  note?: string;
  versionId?: string;
  createdAt?: string;
}

/**
 * Insert or upsert a version snapshot. When `versionId` is omitted a new id
 * is generated deterministically as `${leaseId}-${createdAt}`; when two
 * saves land in the same millisecond a short random suffix disambiguates.
 */
export async function saveVersion(input: SaveVersionInput): Promise<LeaseVersion> {
  const db = await openVersionsDb();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const versionId = input.versionId ?? makeVersionId(input.leaseId, createdAt);
  const record: LeaseVersion = {
    versionId,
    leaseId: input.leaseId,
    createdAt,
    // Snapshot the edits array so later mutations of the caller's array
    // cannot retroactively alter a stored version.
    edits: input.edits.map((e) => ({ ...e })),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  };
  await db.put(VERSIONS, record);
  return record;
}

export async function listVersionsForLease(leaseId: string): Promise<LeaseVersion[]> {
  const db = await openVersionsDb();
  const all = await db.getAllFromIndex(VERSIONS, BY_LEASE, leaseId);
  // Newest first. `createdAt` is ISO-8601 so lexicographic sort is correct.
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export async function getVersion(versionId: string): Promise<LeaseVersion | undefined> {
  const db = await openVersionsDb();
  return db.get(VERSIONS, versionId);
}

export async function deleteVersion(versionId: string): Promise<void> {
  const db = await openVersionsDb();
  await db.delete(VERSIONS, versionId);
}

function makeVersionId(leaseId: string, createdAt: string): string {
  const suffix = randomSuffix();
  return `${leaseId}-${createdAt}-${suffix}`;
}

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
}
