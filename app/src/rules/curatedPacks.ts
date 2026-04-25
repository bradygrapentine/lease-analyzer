/**
 * Curated-pack manifest loader.
 *
 * Reads `/packs/curated/manifest.json` from the same origin (build-time
 * bundled into the PWA's precache — see `scripts/build-curated-packs.mjs`).
 * No network egress beyond the same-origin static asset; CSP-clean.
 */

export interface CuratedPackEntry {
  id: string;
  name: string;
  description: string;
  jurisdictions: string[];
  author: string;
  /** SHA-256 of the canonical signed envelope, hex (64 chars). */
  fingerprint: string;
  /** Same-origin path beginning with `/packs/curated/`. */
  path: string;
}

export type ParseResult =
  | { ok: true; entries: CuratedPackEntry[] }
  | { ok: false; reason: string };

const HEX64 = /^[0-9a-f]{64}$/i;
const CURATED_PREFIX = '/packs/curated/';

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function validateEntry(raw: unknown): CuratedPackEntry | string {
  if (raw === null || typeof raw !== 'object') return 'entry must be an object';
  const e = raw as Record<string, unknown>;
  if (typeof e['id'] !== 'string' || e['id'].length === 0) return 'id missing';
  if (typeof e['name'] !== 'string' || e['name'].length === 0) return 'name missing';
  if (typeof e['description'] !== 'string') return 'description missing';
  if (!isStringArray(e['jurisdictions'])) return 'jurisdictions must be a string array';
  if (typeof e['author'] !== 'string' || e['author'].length === 0) return 'author missing';
  if (typeof e['fingerprint'] !== 'string' || !HEX64.test(e['fingerprint']))
    return 'fingerprint must be 64 hex chars';
  if (typeof e['path'] !== 'string' || !e['path'].startsWith(CURATED_PREFIX))
    return `path must start with ${CURATED_PREFIX}`;
  return {
    id: e['id'],
    name: e['name'],
    description: e['description'],
    jurisdictions: e['jurisdictions'],
    author: e['author'],
    fingerprint: e['fingerprint'],
    path: e['path'],
  };
}

export function parseCuratedManifest(raw: unknown): ParseResult {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'manifest root must be an array' };
  }
  const entries: CuratedPackEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = validateEntry(raw[i]);
    if (typeof r === 'string') {
      return { ok: false, reason: `entry ${i}: ${r}` };
    }
    entries.push(r);
  }
  return { ok: true, entries };
}

export async function loadCuratedManifest(): Promise<CuratedPackEntry[]> {
  const res = await fetch('/packs/curated/manifest.json');
  if (!res.ok) {
    throw new Error(`failed to load curated manifest: HTTP ${res.status}`);
  }
  const raw: unknown = await res.json();
  const parsed = parseCuratedManifest(raw);
  if (!parsed.ok) {
    throw new Error(`malformed curated manifest: ${parsed.reason}`);
  }
  return parsed.entries;
}
