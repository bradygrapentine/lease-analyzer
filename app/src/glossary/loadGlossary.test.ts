import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGlossary, _resetGlossaryCacheForTests } from './loadGlossary';

const originalFetch = globalThis.fetch;

function stubFetch(impl: (input: RequestInfo | URL) => Promise<Response>): void {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

beforeEach(() => {
  _resetGlossaryCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetGlossaryCacheForTests();
});

describe('loadGlossary', () => {
  it('fetches the same-origin /glossary/v1.json and returns parsed entries', async () => {
    const calls: (RequestInfo | URL)[] = [];
    stubFetch(async (input) => {
      calls.push(input);
      return new Response(
        JSON.stringify({
          schema: 'leaseguard.glossary.v1',
          version: 1,
          entries: [
            { term: 'Premises', definition: 'the leased space' },
            { term: 'CAM', definition: 'common area maintenance', sources: ['v1'] },
          ],
        }),
        { status: 200 },
      );
    });

    const g = await loadGlossary();
    expect(calls).toEqual(['/glossary/v1.json']);
    expect(g.schema).toBe('leaseguard.glossary.v1');
    expect(g.version).toBe(1);
    expect(g.entries).toHaveLength(2);
    expect(g.entries[0]).toEqual({ term: 'Premises', definition: 'the leased space' });
    expect(g.entries[1]?.sources).toEqual(['v1']);
  });

  it('caches the result; a second call does not re-fetch', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ schema: 'leaseguard.glossary.v1', version: 1, entries: [] }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await loadGlossary();
    await loadGlossary();
    await loadGlossary();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an empty glossary on malformed JSON without throwing', async () => {
    stubFetch(async () => new Response('not json{', { status: 200 }));
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
    expect(g.schema).toBe('leaseguard.glossary.v1');
  });

  it('returns an empty glossary when the schema marker is wrong', async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ schema: 'something.else', version: 1, entries: [] }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns an empty glossary when an entry is missing required fields', async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            schema: 'leaseguard.glossary.v1',
            version: 1,
            entries: [{ term: 'OK', definition: 'fine' }, { term: 'broken' }],
          }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns an empty glossary when fetch rejects (network error)', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns an empty glossary on a non-OK response', async () => {
    stubFetch(async () => new Response('', { status: 404 }));
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('drops the optional sources field when not present, keeps it when valid', async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            schema: 'leaseguard.glossary.v1',
            version: 1,
            entries: [
              { term: 'A', definition: 'no sources' },
              { term: 'B', definition: 'with sources', sources: ['x', 'y'] },
            ],
          }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries[0]).toEqual({ term: 'A', definition: 'no sources' });
    expect(g.entries[0]?.sources).toBeUndefined();
    expect(g.entries[1]?.sources).toEqual(['x', 'y']);
  });

  it('rejects an entry whose sources is not an array of strings', async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            schema: 'leaseguard.glossary.v1',
            version: 1,
            entries: [{ term: 'A', definition: 'd', sources: [1, 2] }],
          }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns empty glossary when the top-level payload is not an object (e.g. array)', async () => {
    // Exercises the !isRecord(raw) branch — a non-null non-object response
    // (like a bare array) must not crash the validator.
    stubFetch(async () => new Response(JSON.stringify([1, 2, 3]), { status: 200 }));
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns empty glossary when the schema version number is wrong', async () => {
    // Exercises the raw.version !== 1 branch — a future schema bump should
    // be silently ignored rather than crashing the consumer.
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ schema: 'leaseguard.glossary.v1', version: 2, entries: [] }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns empty glossary when entries is not an array', async () => {
    // Exercises the !Array.isArray(raw.entries) branch — a payload where
    // entries is an object or null must not partially populate the glossary.
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ schema: 'leaseguard.glossary.v1', version: 1, entries: {} }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns empty glossary when an entry is a non-object (e.g. string)', async () => {
    // Exercises the !isRecord(e) per-entry guard — ensures a corrupted
    // entry (bare string) does not bypass structural validation.
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            schema: 'leaseguard.glossary.v1',
            version: 1,
            entries: ['not-an-object'],
          }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });

  it('returns empty glossary when sources is present but not an array', async () => {
    // Exercises the !Array.isArray(e.sources) branch — a sources field that
    // is a plain string (not an array) must invalidate the whole glossary.
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            schema: 'leaseguard.glossary.v1',
            version: 1,
            entries: [{ term: 'A', definition: 'd', sources: 'not-array' }],
          }),
          { status: 200 },
        ),
    );
    const g = await loadGlossary();
    expect(g.entries).toEqual([]);
  });
});
