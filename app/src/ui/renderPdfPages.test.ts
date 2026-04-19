import { describe, it, expect } from 'vitest';
import { renderPdfPages } from './renderPdfPages';
import { makePdf } from '../parser/testFixtures';

// jsdom returns null from canvas.getContext('2d') (with a single "not
// implemented" warning). renderPdfPages treats that as "nothing to paint on"
// and yields the page slot immediately, which lets us exercise the
// AbortSignal lifecycle without needing a real canvas backend.
function stubCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  (canvas as unknown as { getContext: () => unknown }).getContext = (): unknown => null;
  return canvas;
}

async function makeSmallPdf(): Promise<Uint8Array> {
  return makePdf([{ blocks: [{ text: 'hello', x: 72, y: 72 }] }]);
}

async function drain(
  iter: AsyncIterable<{ pageIndex: number }>,
): Promise<number[]> {
  const seen: number[] = [];
  for await (const p of iter) seen.push(p.pageIndex);
  return seen;
}

describe('renderPdfPages (AsyncIterable + AbortSignal)', () => {
  it('iterates to completion on the golden path', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    const pages = await drain(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    );
    expect(pages).toEqual([0]);
  });

  it('throws AbortError when the signal is already aborted', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    controller.abort();
    await expect(
      drain(renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws AbortError when aborted between load and render', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    const p = drain(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    );
    // Abort synchronously after kickoff; the next `signal.aborted` check after
    // any internal await (loadPdfjs / getDocument / getPage) will throw.
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('treats abort() after completion as a no-op', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    await drain(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    );
    expect(() => controller.abort()).not.toThrow();
    // A second call after abort should still fail fast rather than leaking.
    await expect(
      drain(renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('works without any signal option', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const pages = await drain(renderPdfPages(new Uint8Array(bytes), [canvas]));
    expect(pages).toEqual([0]);
  });
});

// Streaming-specific tests use the `pdfjsForTests` seam to drive pdf.js
// with deterministic timing. Each test builds a stub that records getPage
// invocations and lets us delay / abort between pages.
function fakePage(): {
  getViewport: () => { width: number; height: number };
  render: () => { promise: Promise<void>; cancel: () => void };
} {
  return {
    getViewport: () => ({ width: 10, height: 10 }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
  };
}

function makeFakePdfjs(
  numPages: number,
  onGetPage: (n: number) => Promise<void>,
): { getDocument: (arg: unknown) => { promise: Promise<unknown>; destroy: () => Promise<void> } } {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages,
        getPage: async (n: number) => {
          await onGetPage(n);
          return fakePage();
        },
      }),
      destroy: async () => {},
    }),
  };
}

describe('renderPdfPages streaming semantics', () => {
  it('yields page 1 before page 2 getPage resolves', async () => {
    const calls: string[] = [];
    let resolvePage2: () => void = () => {};
    const page2Gate = new Promise<void>((resolve) => {
      resolvePage2 = resolve;
    });

    const pdfjs = makeFakePdfjs(2, async (n) => {
      calls.push(`getPage:${n}`);
      if (n === 2) await page2Gate;
    });

    const c1 = stubCanvas();
    const c2 = stubCanvas();
    const iter = renderPdfPages(new Uint8Array([1, 2, 3]), [c1, c2], {
      pdfjsForTests: async () => pdfjs as never,
    })[Symbol.asyncIterator]();

    const first = await iter.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual({ pageIndex: 0 });
    // page 1 observable to caller — page 2's getPage is outstanding, not awaited.
    expect(calls).toEqual(['getPage:1']);

    resolvePage2();
    const second = await iter.next();
    expect(second.value).toEqual({ pageIndex: 1 });
    const third = await iter.next();
    expect(third.done).toBe(true);
    expect(calls).toEqual(['getPage:1', 'getPage:2']);
  });

  it('abort mid-stream ends iteration and skips remaining getPage calls', async () => {
    const calls: string[] = [];
    const pdfjs = makeFakePdfjs(3, async (n) => {
      calls.push(`getPage:${n}`);
    });

    const controller = new AbortController();
    const iter = renderPdfPages(
      new Uint8Array([1, 2, 3]),
      [stubCanvas(), stubCanvas(), stubCanvas()],
      {
        signal: controller.signal,
        pdfjsForTests: async () => pdfjs as never,
      },
    )[Symbol.asyncIterator]();

    const first = await iter.next();
    expect(first.done).toBe(false);
    expect(calls).toEqual(['getPage:1']);

    controller.abort();
    await expect(iter.next()).rejects.toMatchObject({ name: 'AbortError' });

    // After the AbortError, iteration has ended and no further getPage fired.
    expect(calls).toEqual(['getPage:1']);
  });

  it('iterator.return() ends iteration cleanly without starting the next page', async () => {
    const calls: string[] = [];
    const pdfjs = makeFakePdfjs(3, async (n) => {
      calls.push(`getPage:${n}`);
    });

    const iter = renderPdfPages(
      new Uint8Array([1, 2, 3]),
      [stubCanvas(), stubCanvas(), stubCanvas()],
      { pdfjsForTests: async () => pdfjs as never },
    )[Symbol.asyncIterator]();

    const first = await iter.next();
    expect(first.done).toBe(false);
    expect(calls).toEqual(['getPage:1']);

    const ret = await iter.return?.();
    expect(ret).toEqual({ value: undefined, done: true });
    // Subsequent next() is a clean done.
    const after = await iter.next();
    expect(after.done).toBe(true);
    expect(calls).toEqual(['getPage:1']);
  });
});
