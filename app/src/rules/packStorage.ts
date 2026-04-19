import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RulePackFile } from './packSchema';

// Intentionally separate from the leases DB. Schema lives in its own
// database so the Phase 10 pack work can never migrate the lease store.
const DB_NAME = 'leaseguard-packs';
const DB_VERSION = 1;
const PACKS = 'packs';
const ENABLED = 'enabled';

interface PacksSchema extends DBSchema {
  [PACKS]: {
    key: string;
    value: RulePackFile;
  };
  [ENABLED]: {
    key: string;
    value: boolean;
  };
}

let dbPromise: Promise<IDBPDatabase<PacksSchema>> | null = null;

export function _resetPacksDbForTests(): void {
  dbPromise = null;
}

export async function openPacksDb(): Promise<IDBPDatabase<PacksSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PacksSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(PACKS)) {
            db.createObjectStore(PACKS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(ENABLED)) {
            db.createObjectStore(ENABLED);
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function saveInstalledPack(pack: RulePackFile): Promise<void> {
  const db = await openPacksDb();
  await db.put(PACKS, pack);
}

export async function listInstalledPacks(): Promise<RulePackFile[]> {
  const db = await openPacksDb();
  return db.getAll(PACKS);
}

export async function getPackEnabled(id: string): Promise<boolean> {
  const db = await openPacksDb();
  const v = await db.get(ENABLED, id);
  return v === true;
}

export async function setPackEnabled(id: string, enabled: boolean): Promise<void> {
  const db = await openPacksDb();
  await db.put(ENABLED, enabled, id);
}

export async function deleteInstalledPack(id: string): Promise<void> {
  const db = await openPacksDb();
  const tx = db.transaction([PACKS, ENABLED], 'readwrite');
  await tx.objectStore(PACKS).delete(id);
  await tx.objectStore(ENABLED).delete(id);
  await tx.done;
}
