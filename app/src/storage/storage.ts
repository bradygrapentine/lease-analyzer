import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

const DB_NAME = 'leaseguard';
const DB_VERSION = 2;
const STORE = 'leases';
const SETTINGS = 'settings';
const STANDARD_KEY = 'standardLeaseId';

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
}

let dbPromise: Promise<IDBPDatabase<LeaseGuardSchema>> | null = null;

export function _resetDbForTests(): void {
  dbPromise = null;
}

export async function openLeaseDb(): Promise<IDBPDatabase<LeaseGuardSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LeaseGuardSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS);
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

function randomId(): string {
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
