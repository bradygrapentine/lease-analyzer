import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Append-only, hash-chained audit log (Phase 12).
 *
 * Kept in its own IndexedDB database (`leaseguard-audit`) so tampering with —
 * or wiping — the main lease store can never silently rewrite history here.
 * Each entry's `entryHash` covers the previous entry's hash, giving a simple
 * Merkle-ish chain verifiable by `verifyAuditChain`.
 */

export const AUDIT_DB_NAME = 'leaseguard-audit';
const AUDIT_DB_VERSION = 1;
const ENTRIES = 'entries';

export interface AuditEntry {
  /** 1-indexed, strictly increasing. */
  seq: number;
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
  /**
   * Free-form event kind. The well-known set is enumerated for discoverability
   * but callers may pass any string to keep the log extensible.
   */
  kind:
    | 'analyze'
    | 'export'
    | 'import-pack'
    | 'save-lease'
    | 'delete-lease'
    | 'hybrid-feedback'
    | string;
  payload: Record<string, unknown>;
  /** SHA-256 hex of the previous entry's canonical JSON, '' for seq=1. */
  prevHash: string;
  /** SHA-256 hex of the canonical JSON of {seq,timestamp,kind,payload,prevHash}. */
  entryHash: string;
  /**
   * Wave 8 Part D — which signing key id (e.g. 'k0', 'k1') was active when
   * this entry was appended. Old entries that predate this field default to
   * 'k0' (DEFAULT_KEY_ID) for back-compat. Intentionally NOT covered by the
   * hash chain so adding the field is back-compat with v1 audit logs.
   */
  signedByKeyId?: string;
}

/**
 * Default key id assigned to legacy audit entries with no `signedByKeyId`
 * field. Matches the v1 -> v2 signing-store migration which renames the
 * legacy single key to 'k0'.
 */
export const DEFAULT_KEY_ID = 'k0';

interface AuditSchema extends DBSchema {
  [ENTRIES]: {
    key: number;
    value: AuditEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<AuditSchema>> | null = null;

export function _resetAuditDbForTests(): void {
  if (dbPromise) {
    void dbPromise.then((db) => {
      db.close();
    });
  }
  dbPromise = null;
}

export async function openAuditDb(): Promise<IDBPDatabase<AuditSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AuditSchema>(AUDIT_DB_NAME, AUDIT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ENTRIES)) {
          db.createObjectStore(ENTRIES, { keyPath: 'seq' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── canonical JSON + hashing ──────────────────────────────────────────

/**
 * JSON.stringify with object keys sorted lexicographically at every depth.
 * Arrays keep their order (arrays are ordered data). No whitespace, no
 * ASCII escaping tricks — `JSON.stringify` already escapes control chars.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const view = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const b = view[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

function hashableView(
  entry: Pick<AuditEntry, 'seq' | 'timestamp' | 'kind' | 'payload' | 'prevHash'>,
): Record<string, unknown> {
  return {
    seq: entry.seq,
    timestamp: entry.timestamp,
    kind: entry.kind,
    payload: entry.payload,
    prevHash: entry.prevHash,
  };
}

async function computeEntryHash(
  entry: Pick<AuditEntry, 'seq' | 'timestamp' | 'kind' | 'payload' | 'prevHash'>,
): Promise<string> {
  return sha256Hex(canonicalJsonStringify(hashableView(entry)));
}

// ─── public API ────────────────────────────────────────────────────────

export interface AppendInput {
  kind: AuditEntry['kind'];
  payload: Record<string, unknown>;
  /**
   * Optional explicit signing key id. When omitted, the entry is recorded as
   * signed by `DEFAULT_KEY_ID` ('k0'). Callers that have rotated keys should
   * pass the active key id from `signingKeys.getActiveKey()`.
   *
   * Wave 8 Part D follow-up: previously this was auto-resolved by walking the
   * audit log for the most recent 'key-rotated' marker, but that extra IDB
   * read widened a pre-existing race window in `appendAuditEntry` where two
   * concurrent callers could read the same `maxSeq` and both attempt to write
   * the same `seq`, triggering an InvalidStateError. The caller already knows
   * the active key, so we accept it as input instead.
   */
  signedByKeyId?: string;
}

/**
 * Compute `seq`, look up the previous `entryHash`, and write the new entry.
 *
 * IDB transactions auto-commit once the microtask queue drains between IDB
 * operations, so we can't `await crypto.subtle.digest(...)` *inside* a single
 * tx. Instead we do a readonly peek for the previous hash, hash outside any
 * tx, then open a short readwrite tx for the `put`. fake-indexeddb serializes
 * writes to the same store, and the real browser IDB does too, so this is
 * still race-safe for realistic single-tab usage.
 */
export async function appendAuditEntry(input: AppendInput): Promise<AuditEntry> {
  const db = await openAuditDb();

  // 1. Read the tail of the chain.
  let lastSeq = 0;
  let prevHash = '';
  {
    const tx = db.transaction(ENTRIES, 'readonly');
    const cursor = await tx.objectStore(ENTRIES).openCursor(null, 'prev');
    if (cursor) {
      lastSeq = cursor.value.seq;
      prevHash = cursor.value.entryHash;
    }
    await tx.done;
  }

  // 2. Hash outside of any IDB tx — WebCrypto promises tick the event loop
  //    and would otherwise auto-commit the tx mid-flight.
  const seq = lastSeq + 1;
  const timestamp = new Date().toISOString();
  const base = {
    seq,
    timestamp,
    kind: input.kind,
    payload: input.payload,
    prevHash,
  };
  const entryHash = await computeEntryHash(base);

  // 3. Resolve signedByKeyId. Wave 8 Part D — entries record which signing
  // key id was active at append time so verifiers know which public key to
  // check historical entries against. The hash chain itself does NOT cover
  // this field, so adding it is back-compat with v1 audit logs.
  //
  // Wave 8 Part D follow-up: we used to auto-resolve from the most recent
  // 'key-rotated' marker via a second readonly cursor walk. That widened the
  // window between the maxSeq read (step 1) and the put (step 4) enough that
  // concurrent callers (e.g. VersionHistoryPanel firing restore + export +
  // delete back-to-back) collided on the same seq and the put rejected with
  // InvalidStateError. We now require the caller to pass the active key id
  // — `signingKeys.getActiveKey()` already knows it — and fall back to
  // DEFAULT_KEY_ID otherwise. No extra IDB read.
  const explicit = input.signedByKeyId;
  const signedByKeyId: string =
    typeof explicit === 'string' ? explicit : DEFAULT_KEY_ID;
  const entry: AuditEntry = { ...base, entryHash, signedByKeyId };

  // 4. Write.
  await db.put(ENTRIES, entry);
  return entry;
}

export async function listAuditEntries(): Promise<AuditEntry[]> {
  const db = await openAuditDb();
  const all = await db.getAll(ENTRIES);
  // getAll on a keyPath store returns by key order (ascending), which is
  // also seq order. Sort defensively in case fake-indexeddb ever changes.
  // Wave 8 Part D — back-fill `signedByKeyId` to DEFAULT_KEY_ID for any
  // legacy entries written before the field existed.
  return all
    .sort((a, b) => a.seq - b.seq)
    .map((e) => ({
      ...e,
      signedByKeyId: e.signedByKeyId ?? DEFAULT_KEY_ID,
    }));
}

export interface ChainVerification {
  ok: boolean;
  firstBadSeq?: number;
}

/**
 * Re-hash every entry and check each `prevHash` linkage. Returns the lowest
 * seq that fails verification; returns `{ ok: true }` for an empty or intact
 * chain. A missing seq (gap) is reported at the position the gap starts.
 */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const entries = await listAuditEntries();
  let expectedPrev = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    const expectedSeq = i + 1;
    if (e.seq !== expectedSeq) {
      return { ok: false, firstBadSeq: expectedSeq };
    }
    if (e.prevHash !== expectedPrev) {
      return { ok: false, firstBadSeq: e.seq };
    }
    const rehash = await computeEntryHash(e);
    if (rehash !== e.entryHash) {
      return { ok: false, firstBadSeq: e.seq };
    }
    expectedPrev = e.entryHash;
  }
  return { ok: true };
}
