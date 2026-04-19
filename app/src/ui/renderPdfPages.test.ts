import { describe, it, expect } from 'vitest';
import { renderPdfPages } from './renderPdfPages';
import { makePdf } from '../parser/testFixtures';

// jsdom returns null from canvas.getContext('2d') (with a single "not
// implemented" warning). renderPdfPages treats that as "nothing to render on"
// and `continue`s past the pdf.js render call, which lets us exercise the
// AbortSignal lifecycle without needing a real canvas backend.
function stubCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  (canvas as unknown as { getContext: () => unknown }).getContext = (): unknown => null;
  return canvas;
}

async function makeSmallPdf(): Promise<Uint8Array> {
  return makePdf([{ blocks: [{ text: 'hello', x: 72, y: 72 }] }]);
}

describe('renderPdfPages (AbortSignal)', () => {
  it('resolves successfully on the golden path', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    await expect(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    ).resolves.toBeUndefined();
  });

  it('rejects with AbortError when the signal is already aborted', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    controller.abort();
    await expect(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects with AbortError when aborted between load and render', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    const p = renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal });
    // Abort synchronously after kickoff; the next `signal.aborted` check after
    // any internal await (loadPdfjs / getDocument / getPage) will throw.
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('treats abort() after completion as a no-op', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    const controller = new AbortController();
    await renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal });
    expect(() => controller.abort()).not.toThrow();
    // A second call after abort should still fail fast rather than leaking.
    await expect(
      renderPdfPages(new Uint8Array(bytes), [canvas], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('works without any signal option', async () => {
    const bytes = await makeSmallPdf();
    const canvas = stubCanvas();
    await expect(renderPdfPages(new Uint8Array(bytes), [canvas])).resolves.toBeUndefined();
  });
});
