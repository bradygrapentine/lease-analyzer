/**
 * Static legal glossary loader (Wave 11 Part A).
 *
 * This module performs the ONE allowed runtime fetch in the app: a
 * same-origin GET of `/glossary/v1.json`, a static asset shipped with
 * the build. The CSP contract (`default-src 'self'`) is preserved
 * because the URL is relative and resolves to the app's own origin.
 *
 * Loaded exactly once per session; subsequent calls return the cached
 * result. Any failure (network error, malformed JSON, schema mismatch)
 * resolves to an empty entry list rather than throwing — the glossary
 * is a UX nicety and must never crash the pipeline.
 */
export interface GlossaryEntry {
  term: string;
  definition: string;
  sources?: string[];
}

export interface Glossary {
  schema: 'leaseguard.glossary.v1';
  version: 1;
  entries: GlossaryEntry[];
}

const EMPTY: Glossary = {
  schema: 'leaseguard.glossary.v1',
  version: 1,
  entries: [],
};

let cached: Promise<Glossary> | null = null;

/**
 * Fetch the static glossary, validate its shape, and cache the result
 * for the rest of the session. On any error returns an empty glossary
 * (still cached, so we don't retry on every render).
 */
export function loadGlossary(): Promise<Glossary> {
  if (cached) return cached;
  cached = fetchAndValidate();
  return cached;
}

async function fetchAndValidate(): Promise<Glossary> {
  try {
    const res = await fetch('/glossary/v1.json');
    if (!res.ok) return EMPTY;
    const raw: unknown = await res.json();
    const parsed = validate(raw);
    return parsed ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function validate(raw: unknown): Glossary | null {
  if (!isRecord(raw)) return null;
  if (raw.schema !== 'leaseguard.glossary.v1') return null;
  if (raw.version !== 1) return null;
  if (!Array.isArray(raw.entries)) return null;
  const entries: GlossaryEntry[] = [];
  for (const e of raw.entries) {
    if (!isRecord(e)) return null;
    if (typeof e.term !== 'string' || e.term.length === 0) return null;
    if (typeof e.definition !== 'string' || e.definition.length === 0) return null;
    let sources: string[] | undefined;
    if (e.sources !== undefined) {
      if (!Array.isArray(e.sources)) return null;
      if (!e.sources.every((s): s is string => typeof s === 'string')) return null;
      sources = [...e.sources];
    }
    const entry: GlossaryEntry = { term: e.term, definition: e.definition };
    if (sources) entry.sources = sources;
    entries.push(entry);
  }
  return {
    schema: 'leaseguard.glossary.v1',
    version: 1,
    entries,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Test-only: clears the per-session cache so each test starts fresh. */
export function _resetGlossaryCacheForTests(): void {
  cached = null;
}
