import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { compileRules, type CompiledRule } from './compileRules';
import type { RulePackFile } from './packSchema';
import {
  verifySignedPack,
  type SignedPackEnvelope,
} from './packSigning';
import type { Rule, Severity } from './types';

// Intentionally separate from the leases DB. Schema lives in its own
// database so the Phase 10 pack work can never migrate the lease store.
const DB_NAME = 'leaseguard-packs';
// v3 adds the SIGNATURES store. Upgrade is strictly additive — no rows
// from v1/v2 are touched, so existing packs + enabled flags survive.
const DB_VERSION = 3;
const PACKS = 'packs';
const ENABLED = 'enabled';
const SETTINGS = 'settings';
const SIGNATURES = 'signatures';

// Singleton keys inside the SETTINGS store.
const KEY_JURISDICTIONS = 'selectedJurisdictions';
// Wave 10 Part D — the legacy `severityOverrides` key holds the portfolio-
// scope map (Record<ruleId, Severity>). Pre-existing rows (no scope concept)
// are implicitly portfolio-scope, matching `migrateLegacyOverrides`. Lease-
// scope overrides live in a sibling key, keyed by leaseId →
// Record<ruleId, Severity>. No IDB schema bump — both keys live in the
// existing v3 SETTINGS store.
const KEY_SEVERITY_OVERRIDES = 'severityOverrides';
const KEY_SEVERITY_OVERRIDES_BY_LEASE = 'severityOverridesByLease';

export type PackSignatureStatus = 'verified' | 'unsigned' | 'invalid' | 'unknown';

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
    // overrides is Record<string, Severity>; Wave 10 Part D adds a
    // Record<leaseId, Record<ruleId, Severity>> entry under the
    // KEY_SEVERITY_OVERRIDES_BY_LEASE key. Keyed by the constants above
    // so reads narrow the type at the call site.
    value:
      | string[]
      | Record<string, Severity>
      | Record<string, Record<string, Severity>>;
  };
  [SIGNATURES]: {
    // Keyed by packId. Value is the full envelope plus the verify result
    // captured at install time so the panel can render a badge without
    // re-running WebCrypto on every render.
    key: string;
    value: {
      packId: string;
      envelope: SignedPackEnvelope;
      status: PackSignatureStatus;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<PacksSchema>> | null = null;

// ─── Phase 13: pre-compiled rule cache ──────────────────────────────
// Two layers:
//   1. `packCompileCache`  — keyed by pack id; invalidated whenever a pack
//      is saved / deleted / enabled / disabled so a re-analyze after a
//      pack mutation picks up the new patterns.
//   2. `activeRulesCache`  — keyed by the *identity* of the caller's
//      `activeRules` array. `usePipeline` already memoizes that array,
//      so a WeakMap keyed on it gives us "compile once per React render
//      cycle, re-use across every doc the user opens in that cycle".
const packCompileCache = new Map<string, CompiledRule[]>();
const activeRulesCache = new WeakMap<Rule[], CompiledRule[]>();

function invalidateCompileCaches(packId?: string): void {
  if (packId !== undefined) packCompileCache.delete(packId);
  else packCompileCache.clear();
  // WeakMap: entries disappear when the key array is GC'd; we don't
  // enumerate, but stale compiled rules are harmless — `compileRules`
  // is idempotent, so the next call just produces a fresh cache when
  // the caller passes a new `activeRules` identity.
}

export function _resetCompileCachesForTests(): void {
  packCompileCache.clear();
  // Cannot clear a WeakMap; tests should simply hand a fresh `activeRules`
  // array, which is the real-world pattern anyway.
}

export function _resetPacksDbForTests(): void {
  dbPromise = null;
  _resetCompileCachesForTests();
}

/**
 * Return compiled-rule form of an installed pack, cached by pack id. The
 * cache is invalidated on save / delete / enable / disable so subsequent
 * `analyze` calls pick up the new patterns automatically.
 */
export function getCompiledRulesForPack(pack: RulePackFile): CompiledRule[] {
  const cached = packCompileCache.get(pack.id);
  if (cached) return cached;
  const compiled = compileRules(pack.rules);
  packCompileCache.set(pack.id, compiled);
  return compiled;
}

/**
 * Memoize `compileRules(activeRules)` by the identity of `activeRules`.
 * Callers (`usePipeline`) already stabilise the array reference across
 * renders, so repeated `analyze` calls inside a single session skip the
 * RegExp / keyword-lowercase step entirely.
 *
 * Plain-`Rule[]` consumers keep working without change — this helper is
 * opt-in, and `analyze` itself falls back to inline compilation when the
 * caller hasn't pre-compiled.
 */
export function getActiveCompiledRules(activeRules: Rule[]): CompiledRule[] {
  const cached = activeRulesCache.get(activeRules);
  if (cached) return cached;
  const compiled = compileRules(activeRules);
  activeRulesCache.set(activeRules, compiled);
  return compiled;
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
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(SIGNATURES)) {
            db.createObjectStore(SIGNATURES, { keyPath: 'packId' });
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
  invalidateCompileCaches(pack.id);
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
  invalidateCompileCaches(id);
}

export async function deleteInstalledPack(id: string): Promise<void> {
  const db = await openPacksDb();
  const tx = db.transaction([PACKS, ENABLED, SIGNATURES], 'readwrite');
  await tx.objectStore(PACKS).delete(id);
  await tx.objectStore(ENABLED).delete(id);
  await tx.objectStore(SIGNATURES).delete(id);
  await tx.done;
  invalidateCompileCaches(id);
}

// ─── Phase 10 signed pack envelope persistence ──────────────────────

/**
 * Install a pack that arrived with a signature envelope. Verifies the
 * envelope before writing — a failed verify rejects without touching the
 * store. On success the envelope + verified status are recorded so the
 * UI can render a trust badge.
 *
 * `envelope.payload` may deserialize to a different pack than the one
 * passed in (for example, a caller that re-parsed the envelope and
 * handed us the inner pack); the stored record always uses the pack
 * recovered from the envelope to guarantee pack + signature are
 * consistent on-disk.
 */
export async function saveSignedPack(
  envelope: SignedPackEnvelope,
  _pack: RulePackFile,
): Promise<void> {
  const result = await verifySignedPack(envelope);
  if (!result.ok || !result.pack) {
    throw new Error(`signed pack failed verification: ${result.reason ?? 'unknown'}`);
  }
  const db = await openPacksDb();
  const tx = db.transaction([PACKS, SIGNATURES], 'readwrite');
  await tx.objectStore(PACKS).put(result.pack);
  await tx.objectStore(SIGNATURES).put({
    packId: result.pack.id,
    envelope,
    status: 'verified',
  });
  await tx.done;
}

/**
 * Report the signature state of an installed pack:
 *   - `verified`: signature was present and verified at install time.
 *   - `invalid`:  envelope is stored but verify now fails (shouldn't
 *                 happen for packs written via saveSignedPack, but covers
 *                 manually-imported envelopes + data corruption).
 *   - `unsigned`: the pack is installed but has no envelope.
 *   - `unknown`:  no pack exists under that id.
 */
export async function getPackSignatureStatus(
  packId: string,
): Promise<PackSignatureStatus> {
  const db = await openPacksDb();
  const pack = await db.get(PACKS, packId);
  if (!pack) return 'unknown';
  const sig = await db.get(SIGNATURES, packId);
  if (!sig) return 'unsigned';
  // Re-verify lazily if the stored status is anything other than
  // verified; the expected path (install-time verify) short-circuits
  // this to avoid recomputing every time.
  if (sig.status === 'verified') return 'verified';
  const result = await verifySignedPack(sig.envelope);
  return result.ok ? 'verified' : 'invalid';
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

/**
 * Read severity overrides. Behavior:
 *
 *  - No filter (or `{ scope: 'portfolio' }`) — returns the flat portfolio-
 *    scope map (legacy rows are implicitly portfolio-scope).
 *  - `{ scope: 'lease', leaseId }` — returns the override map for that lease
 *    only. Returns `{}` if no lease-scope rows exist for the given leaseId.
 *
 * Schema version is unchanged; lease-scope rows live under a sibling key.
 */
export async function getSeverityOverrides(
  filter?: { scope: 'portfolio' } | { scope: 'lease'; leaseId: string },
): Promise<Record<string, Severity>> {
  const db = await openPacksDb();
  if (filter?.scope === 'lease') {
    const v = await db.get(SETTINGS, KEY_SEVERITY_OVERRIDES_BY_LEASE);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
    const byLease = v as unknown as Record<string, unknown>;
    const row = byLease[filter.leaseId];
    return isSeverityMap(row) ? { ...row } : {};
  }
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
