import { describe, it, expect, vi } from 'vitest';
import { discoverOcrLanguages } from './availableLanguages';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe('discoverOcrLanguages', () => {
  it('returns the manifest entries on the happy path', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        schema: 'leaseguard.tesseract.languages.v1',
        languages: [
          { code: 'eng', label: 'English' },
          { code: 'spa', label: 'Spanish' },
        ],
      }),
    );
    const langs = await discoverOcrLanguages(fetchMock as unknown as typeof fetch);
    expect(langs).toEqual([
      { code: 'eng', label: 'English' },
      { code: 'spa', label: 'Spanish' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/tesseract/languages.json');
  });

  it('only fetches the same-origin manifest path', async () => {
    const seenUrls: string[] = [];
    const fetchMock = (async (url: string): Promise<Response> => {
      seenUrls.push(String(url));
      return jsonResponse({
        schema: 'leaseguard.tesseract.languages.v1',
        languages: [{ code: 'eng', label: 'English' }],
      });
    }) as unknown as typeof fetch;
    await discoverOcrLanguages(fetchMock);
    expect(seenUrls).toHaveLength(1);
    const url = seenUrls[0] ?? '';
    expect(url.startsWith('/')).toBe(true);
    expect(url).not.toMatch(/^https?:/);
  });

  it('returns [] when the manifest is missing (404)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false));
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] on a network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] on malformed JSON', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => {
            throw new Error('bad json');
          },
        }) as unknown as Response,
    );
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it('rejects payloads with the wrong schema id', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        schema: 'something.else.v1',
        languages: [{ code: 'eng', label: 'English' }],
      }),
    );
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it('rejects payloads with malformed entries', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        schema: 'leaseguard.tesseract.languages.v1',
        languages: [{ code: 'eng' }],
      }),
    );
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it('returns [] when languages is missing entirely', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ schema: 'leaseguard.tesseract.languages.v1' }),
    );
    expect(await discoverOcrLanguages(fetchMock as unknown as typeof fetch)).toEqual([]);
  });
});
