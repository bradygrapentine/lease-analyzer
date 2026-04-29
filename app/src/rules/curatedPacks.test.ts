import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Wave 8 Part A — module under test does not yet exist; this import
// is the failing-on-purpose signal. The implementer creates
// `src/rules/curatedPacks.ts` exporting `loadCuratedManifest()` and
// `parseCuratedManifest(raw: unknown)`.
import { loadCuratedManifest, parseCuratedManifest, type CuratedPackEntry } from './curatedPacks';
import { at } from '../test/assert';

const VALID_ENTRY: CuratedPackEntry = {
  id: 'us-ca-residential',
  name: 'California residential',
  description: 'Curated residential rules for California.',
  jurisdictions: ['US-CA'],
  author: 'LeaseGuard core',
  fingerprint: 'a'.repeat(64),
  path: '/packs/curated/us-ca-residential.lgpack.json',
};

describe('curatedPacks: parseCuratedManifest', () => {
  it('parses a well-formed manifest with one entry', () => {
    const result = parseCuratedManifest([VALID_ENTRY]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
      expect(at(result.entries, 0).id).toBe('us-ca-residential');
    }
  });

  it('rejects a non-array root', () => {
    const result = parseCuratedManifest({ entries: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects an entry missing required fields', () => {
    const bad = { ...VALID_ENTRY } as Partial<CuratedPackEntry>;
    delete bad.fingerprint;
    const result = parseCuratedManifest([bad]);
    expect(result.ok).toBe(false);
  });

  it('rejects an entry where jurisdictions is not a string array', () => {
    const result = parseCuratedManifest([
      { ...VALID_ENTRY, jurisdictions: 'US-CA' as unknown as string[] },
    ]);
    expect(result.ok).toBe(false);
  });

  // Wave 44: cover validateEntry's per-field error branches that the
  // single "fingerprint missing" test does not exercise.
  it.each([
    ['id', { id: '' }],
    ['name', { name: '' }],
    ['description', { description: 42 as unknown as string }],
    ['author', { author: '' }],
  ])('rejects an entry with bad %s', (_label, override) => {
    const bad = { ...VALID_ENTRY, ...override };
    const result = parseCuratedManifest([bad]);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object entry (string)', () => {
    const result = parseCuratedManifest(['not-an-object' as unknown as CuratedPackEntry]);
    expect(result.ok).toBe(false);
  });

  it('rejects a fingerprint that is not 64 hex chars', () => {
    const result = parseCuratedManifest([{ ...VALID_ENTRY, fingerprint: 'tooshort' }]);
    expect(result.ok).toBe(false);
  });

  it('rejects a path that does not start with /packs/curated/', () => {
    const result = parseCuratedManifest([
      { ...VALID_ENTRY, path: 'https://example.com/evil.json' },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe('curatedPacks: loadCuratedManifest (network-free, same-origin only)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Stub fetch — the loader must call same-origin /packs/curated/manifest.json.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/packs/curated/manifest.json')) {
        return new Response(JSON.stringify([VALID_ENTRY]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches the manifest from the same-origin path and returns typed entries', async () => {
    const entries = await loadCuratedManifest();
    expect(entries).toHaveLength(1);
    expect(at(entries, 0).id).toBe('us-ca-residential');
  });

  it('rejects when fetch returns 404', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('', { status: 404 }),
    ) as unknown as typeof fetch;
    await expect(loadCuratedManifest()).rejects.toThrow();
  });

  it('rejects malformed manifest payloads', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ not: 'an array' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    await expect(loadCuratedManifest()).rejects.toThrow();
  });
});
