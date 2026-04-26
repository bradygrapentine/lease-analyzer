import { describe, it, expect, afterEach, vi } from 'vitest';
import { listCuratedPackUrls } from './packStorage';

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => {
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => payload,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('listCuratedPackUrls', () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('returns the curated paths from a valid manifest', async () => {
    globalThis.fetch = mockFetch([
      {
        id: 'us-ca-residential',
        name: 'CA',
        description: 'd',
        jurisdictions: ['US-CA'],
        author: 'LeaseGuard core',
        fingerprint: 'a'.repeat(64),
        path: '/packs/curated/us-ca-residential.lgpack.json',
      },
      {
        id: 'us-ny-commercial',
        name: 'NY',
        description: 'd',
        jurisdictions: ['US-NY'],
        author: 'LeaseGuard core',
        fingerprint: 'b'.repeat(64),
        path: '/packs/curated/us-ny-commercial.lgpack.json',
      },
    ]);
    const urls = await listCuratedPackUrls();
    expect(urls).toEqual([
      '/packs/curated/us-ca-residential.lgpack.json',
      '/packs/curated/us-ny-commercial.lgpack.json',
    ]);
  });

  it('returns an empty array when the manifest fetch fails', async () => {
    globalThis.fetch = mockFetch(null, false);
    const urls = await listCuratedPackUrls();
    expect(urls).toEqual([]);
  });

  it('returns an empty array when the manifest is malformed', async () => {
    globalThis.fetch = mockFetch({ not: 'an array' });
    const urls = await listCuratedPackUrls();
    expect(urls).toEqual([]);
  });
});
