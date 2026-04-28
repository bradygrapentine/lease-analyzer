/// <reference types="vite/client" />
/**
 * Wave 41 — WCAG 2.1 AA sweep.
 *
 * Renders every Storybook story under `src/ui/**` and runs axe-core
 * against the result. New violations fail this suite — fix them in
 * the originating component, do not relax the assertion.
 *
 * Why stories: each panel already curates its representative states
 * (empty / loaded / error) for visual review. Reusing them gives
 * broad axe coverage without authoring a second set of fixtures here.
 */
import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import { expectAxeClean } from '../../test/axe';

// Vite glob — eager so we don't have to await per file.
const storyModules = import.meta.glob<Record<string, unknown>>('../*.stories.tsx', { eager: true });

describe('Wave 41 — all panel stories pass axe', () => {
  beforeEach(() => {
    // Stories' mock callbacks log to console; jsdom also throws "HTMLCanvasElement.getContext
    // not implemented" inside axe-core's color-contrast probe (it falls back gracefully).
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string' && msg.includes('HTMLCanvasElement')) return;
      // Surface anything unexpected.
      // eslint-disable-next-line no-console
      console.warn.call(console, msg);
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  for (const [path, mod] of Object.entries(storyModules)) {
    const file = path.split('/').pop() ?? path;
    const stories = composeStories(mod as Parameters<typeof composeStories>[0]);
    for (const [storyName, Story] of Object.entries(stories)) {
      it(`${file} → ${storyName}`, async () => {
        const Comp = Story as unknown as () => JSX.Element;
        const { container } = render(<Comp />);
        await expectAxeClean(container);
      });
    }
  }
});
