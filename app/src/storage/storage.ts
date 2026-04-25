import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import type { ClauseTemplate } from '../templates/types';

const DB_NAME = 'leaseguard';
const DB_VERSION = 3;
const STORE = 'leases';
const SETTINGS = 'settings';
const STANDARD_KEY = 'standardLeaseId';
const ONBOARDING_DISMISSED_KEY = 'onboardingDismissedAt';
export const CLAUSE_TEMPLATES_STORE = 'clauseTemplates';

export interface LeaseRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  rulePackVersion: string;
  pageCount: number;
  findingCount: number;
  doc: LeaseDocument;
  findings: Finding[];
}

export interface LeaseMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  rulePackVersion: string;
  pageCount: number;
  findingCount: number;
}

interface LeaseGuardSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: LeaseRecord;
    indexes: { 'by-createdAt': number };
  };
  [SETTINGS]: {
    key: string;
    value: string;
  };
  [CLAUSE_TEMPLATES_STORE]: {
    key: string;
    value: ClauseTemplate;
  };
}

let dbPromise: Promise<IDBPDatabase<LeaseGuardSchema>> | null = null;

export function _resetDbForTests(): void {
  dbPromise = null;
}

export async function openLeaseDb(): Promise<IDBPDatabase<LeaseGuardSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LeaseGuardSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, _tx) {
        // v0 → v1: leases store (keyPath: id, by-createdAt index).
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' });
            store.createIndex('by-createdAt', 'createdAt');
          }
        }
        // v1 → v2: settings store (for standardLeaseId, etc).
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(SETTINGS)) {
            db.createObjectStore(SETTINGS);
          }
        }
        // v2 → v3: clauseTemplates store for user's saved clause-text templates.
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(CLAUSE_TEMPLATES_STORE)) {
            db.createObjectStore(CLAUSE_TEMPLATES_STORE, { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

export interface SaveLeaseInput {
  name: string;
  doc: LeaseDocument;
  findings: Finding[];
}

export async function saveLease(input: SaveLeaseInput): Promise<string> {
  const db = await openLeaseDb();
  const now = Date.now();
  const id = randomId();
  const record: LeaseRecord = {
    id,
    name: input.name,
    createdAt: now,
    updatedAt: now,
    rulePackVersion: input.findings[0]?.rulePackVersion ?? 'unknown',
    pageCount: input.doc.pages.length,
    findingCount: input.findings.length,
    doc: input.doc,
    findings: input.findings,
  };
  await db.put(STORE, record);
  return id;
}

export async function getLease(id: string): Promise<LeaseRecord | undefined> {
  const db = await openLeaseDb();
  return db.get(STORE, id);
}

export async function listLeases(): Promise<LeaseMetadata[]> {
  const db = await openLeaseDb();
  const all = await db.getAll(STORE);
  return all
    .map(({ doc: _doc, findings: _findings, ...meta }) => meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function renameLease(id: string, name: string): Promise<void> {
  const db = await openLeaseDb();
  const existing = await db.get(STORE, id);
  if (!existing) throw new Error(`lease ${id} not found`);
  existing.name = name;
  existing.updatedAt = Date.now();
  await db.put(STORE, existing);
}

export async function deleteLease(id: string): Promise<void> {
  const db = await openLeaseDb();
  await db.delete(STORE, id);
}

export async function clearAll(): Promise<void> {
  const db = await openLeaseDb();
  await db.clear(STORE);
  await db.clear(SETTINGS);
  await db.clear(CLAUSE_TEMPLATES_STORE);
}

export async function listAllLeaseRecords(): Promise<LeaseRecord[]> {
  const db = await openLeaseDb();
  return db.getAll(STORE);
}

export async function replaceAllLeases(
  records: LeaseRecord[],
  standardId: string | null,
): Promise<void> {
  const db = await openLeaseDb();
  const tx = db.transaction([STORE, SETTINGS], 'readwrite');
  await tx.objectStore(STORE).clear();
  for (const record of records) {
    await tx.objectStore(STORE).put(record);
  }
  if (standardId) {
    await tx.objectStore(SETTINGS).put(standardId, STANDARD_KEY);
  } else {
    await tx.objectStore(SETTINGS).delete(STANDARD_KEY);
  }
  await tx.done;
}

export async function setStandardId(id: string): Promise<void> {
  const db = await openLeaseDb();
  await db.put(SETTINGS, id, STANDARD_KEY);
}

export async function getStandardId(): Promise<string | undefined> {
  const db = await openLeaseDb();
  return db.get(SETTINGS, STANDARD_KEY);
}

export async function clearStandardId(): Promise<void> {
  const db = await openLeaseDb();
  await db.delete(SETTINGS, STANDARD_KEY);
}

// Onboarding tour dismissal timestamp. Stored as a JSON-encoded number in
// the existing SETTINGS store (value type: string), so no schema bump is
// required. `null` (or unset) means "first run, show the tour".
export async function getOnboardingDismissedAt(): Promise<number | null> {
  const db = await openLeaseDb();
  const raw = await db.get(SETTINGS, ONBOARDING_DISMISSED_KEY);
  if (raw === undefined) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setOnboardingDismissedAt(ts: number): Promise<void> {
  const db = await openLeaseDb();
  await db.put(SETTINGS, String(ts), ONBOARDING_DISMISSED_KEY);
}

export async function clearOnboardingDismissedAt(): Promise<void> {
  const db = await openLeaseDb();
  await db.delete(SETTINGS, ONBOARDING_DISMISSED_KEY);
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Non-crypto fallback (tests without Web Crypto).
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
}
