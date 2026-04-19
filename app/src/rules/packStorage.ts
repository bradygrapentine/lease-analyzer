import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RulePackFile } from './packSchema';
import type { Severity } from './types';

// Intentionally separate from the leases DB. Schema lives in its own
// database so the Phase 10 pack work can never migrate the lease store.
const DB_NAME = 'leaseguard-packs';
const DB_VERSION = 2;
const PACKS = 'packs';
const ENABLED = 'enabled';
const SETTINGS = 'settings';

// Singleton keys inside the SETTINGS store.
const KEY_JURISDICTIONS = 'selectedJurisdictions';
const KEY_SEVERITY_OVERRIDES = 'severityOverrides';

interface PacksSchema extends DBSchema {
  [PACKS]: {
    key: string;
    value: RulePackFile;
  };
  [ENABLED]: {
    key: string;
    value: boolean;
  };
  [SETTINGS]: {
    key: string;
    // Heterogeneous singleton store: jurisdictions is string[], severity
    // overrides is Record<string, Severity>. Keyed by the constants above
    // so reads narrow the type at the call site.
    value: string[] | Record<string, Severity>;
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
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(SETTINGS)) {
            db.createObjectStore(SETTINGS);
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

// ─── Phase 10b settings (jurisdictions + severity overrides) ────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export async function getSelectedJurisdictions(): Promise<string[]> {
  const db = await openPacksDb();
  const v = await db.get(SETTINGS, KEY_JURISDICTIONS);
  return isStringArray(v) ? v.slice() : [];
}

export async function setSelectedJurisdictions(
  codes: readonly string[],
): Promise<void> {
  const db = await openPacksDb();
  // De-dupe defensively so the store stays canonical.
  const unique = Array.from(new Set(codes));
  await db.put(SETTINGS, unique, KEY_JURISDICTIONS);
}

const VALID_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>([
  'high',
  'medium',
  'low',
  'info',
]);

function isSeverityMap(v: unknown): v is Record<string, Severity> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(
    (s) => typeof s === 'string' && VALID_SEVERITIES.has(s as Severity),
  );
}

export async function getSeverityOverrides(): Promise<Record<string, Severity>> {
  const db = await openPacksDb();
  const v = await db.get(SETTINGS, KEY_SEVERITY_OVERRIDES);
  return isSeverityMap(v) ? { ...v } : {};
}

/**
 * Set (or delete) a single rule's severity override. Passing `severity=null`
 * removes the override entry; passing a Severity writes it.
 */
export async function setSeverityOverride(
  ruleId: string,
  severity: Severity | null,
): Promise<void> {
  const db = await openPacksDb();
  const tx = db.transaction(SETTINGS, 'readwrite');
  const store = tx.objectStore(SETTINGS);
  const existing = await store.get(KEY_SEVERITY_OVERRIDES);
  const next: Record<string, Severity> = isSeverityMap(existing)
    ? { ...existing }
    : {};
  if (severity === null) {
    delete next[ruleId];
  } else {
    next[ruleId] = severity;
  }
  await store.put(next, KEY_SEVERITY_OVERRIDES);
  await tx.done;
}
