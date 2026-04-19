import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Counter-offers extend the clause-template idea (per Phase 5) but are
// keyed by rule id so the user can keep multiple suggested rewrites per
// finding. Stored in their OWN IndexedDB database (same pattern as
// packStorage) — `storage.ts` is never touched by Phase 9.
const DB_NAME = 'leaseguard-counters';
const DB_VERSION = 1;
const STORE = 'counters';
const BY_RULE = 'by-ruleId';

export interface CounterOffer {
  id: string;
  ruleId: string;
  name: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

interface CountersSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: CounterOffer;
    indexes: { [BY_RULE]: string };
  };
}

let dbPromise: Promise<IDBPDatabase<CountersSchema>> | null = null;

export function _resetCountersDbForTests(): void {
  dbPromise = null;
}

export async function openCountersDb(): Promise<IDBPDatabase<CountersSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CountersSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' });
            store.createIndex(BY_RULE, 'ruleId');
          }
        }
      },
    });
  }
  return dbPromise;
}

export interface SaveCounterOfferInput {
  ruleId: string;
  name: string;
  text: string;
}

export async function saveCounterOffer(input: SaveCounterOfferInput): Promise<string> {
  const db = await openCountersDb();
  const now = Date.now();
  const id = randomId();
  const record: CounterOffer = {
    id,
    ruleId: input.ruleId,
    name: input.name,
    text: input.text,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(STORE, record);
  return id;
}

export interface ListCounterOffersInput {
  ruleId?: string;
}

export async function listCounterOffers(
  input: ListCounterOffersInput = {},
): Promise<CounterOffer[]> {
  const db = await openCountersDb();
  const all = input.ruleId
    ? await db.getAllFromIndex(STORE, BY_RULE, input.ruleId)
    : await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export interface UpdateCounterOfferInput {
  name?: string;
  text?: string;
}

export async function updateCounterOffer(
  id: string,
  patch: UpdateCounterOfferInput,
): Promise<void> {
  const db = await openCountersDb();
  const existing = await db.get(STORE, id);
  if (!existing) throw new Error(`counter-offer ${id} not found`);
  if (patch.name !== undefined) existing.name = patch.name;
  if (patch.text !== undefined) existing.text = patch.text;
  existing.updatedAt = Date.now();
  await db.put(STORE, existing);
}

export async function deleteCounterOffer(id: string): Promise<void> {
  const db = await openCountersDb();
  await db.delete(STORE, id);
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
