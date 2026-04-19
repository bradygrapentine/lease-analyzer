import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Annotations live in their OWN IndexedDB database so they never need to
// migrate the main `leaseguard` lease/settings/templates store. Same
// pattern as `rules/packStorage.ts`.
const DB_NAME = 'leaseguard-annotations';
const DB_VERSION = 1;
const STORE = 'annotations';
const BY_LEASE = 'by-leaseId';

export interface Annotation {
  id: string;
  leaseId: string;
  paragraphIndex: number;
  text: string;
  createdAt: number;
  updatedAt: number;
}

interface AnnotationsSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: Annotation;
    indexes: { [BY_LEASE]: string };
  };
}

let dbPromise: Promise<IDBPDatabase<AnnotationsSchema>> | null = null;

export function _resetAnnotationsDbForTests(): void {
  dbPromise = null;
}

export async function openAnnotationsDb(): Promise<IDBPDatabase<AnnotationsSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AnnotationsSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' });
            store.createIndex(BY_LEASE, 'leaseId');
          }
        }
      },
    });
  }
  return dbPromise;
}

export interface SaveAnnotationInput {
  leaseId: string;
  paragraphIndex: number;
  text: string;
}

export async function saveAnnotation(input: SaveAnnotationInput): Promise<string> {
  const db = await openAnnotationsDb();
  const now = Date.now();
  const id = randomId();
  const record: Annotation = {
    id,
    leaseId: input.leaseId,
    paragraphIndex: input.paragraphIndex,
    text: input.text,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(STORE, record);
  return id;
}

export async function listAnnotations(leaseId: string): Promise<Annotation[]> {
  const db = await openAnnotationsDb();
  const all = await db.getAllFromIndex(STORE, BY_LEASE, leaseId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateAnnotation(id: string, text: string): Promise<void> {
  const db = await openAnnotationsDb();
  const existing = await db.get(STORE, id);
  if (!existing) throw new Error(`annotation ${id} not found`);
  existing.text = text;
  existing.updatedAt = Date.now();
  await db.put(STORE, existing);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await openAnnotationsDb();
  await db.delete(STORE, id);
}

export async function deleteAllForLease(leaseId: string): Promise<void> {
  const db = await openAnnotationsDb();
  const tx = db.transaction(STORE, 'readwrite');
  const idx = tx.store.index(BY_LEASE);
  let cursor = await idx.openCursor(IDBKeyRange.only(leaseId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
}
