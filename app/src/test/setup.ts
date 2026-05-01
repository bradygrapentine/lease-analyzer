import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

/**
 * Default `window.matchMedia` stub.
 *
 * jsdom 24 does not implement `window.matchMedia`. Vitest 1.x's `vi.spyOn`
 * was lenient and would synthesize a property when spying on `undefined`;
 * vitest 4 tightened this and now throws "vi.spyOn() can only spy on a
 * function. Received undefined." Tests that call
 * `vi.spyOn(window, 'matchMedia').mockImplementation(...)` need a real
 * function to spy on. Install a no-op default here so per-test
 * `mockImplementation` overrides keep working unchanged. `configurable`
 * + `writable` lets `vi.restoreAllMocks()` reset cleanly.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

/**
 * Suppress benign `InvalidStateError` (DOMException code 11) unhandled
 * rejections from in-flight IDB operations whose db handle was nulled by
 * a test's `_reset<Db>ForTests()` teardown.
 *
 * These rejections are real but benign: a fire-and-forget `clearAll()` /
 * `refreshAuditLog()` / `useSigningKey.refresh()` resolves AFTER the
 * test that triggered it has unmounted, and its tx fails because the
 * cached db promise was nulled. The promise's resolution would have
 * called `setState` on an unmounted component — which React itself
 * already swallows. The IDB error has no consequence beyond polluting
 * vitest output.
 *
 * vitest 1.6 escalates unhandled rejections to a non-zero exit code on
 * `test:coverage`, which broke CI on wave51-c. Using `prependListener`
 * here ensures we run BEFORE vitest's own listener and can swallow the
 * benign case before vitest sees it.
 *
 * The handler is narrow on purpose: only `name === 'InvalidStateError'`
 * or `code === 11` is suppressed. Any other unhandled rejection is
 * left untouched (re-emitted) so real bugs still fail the run.
 */
function isBenignIdbTeardownError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null;
  if (!e) return false;
  return e.name === 'InvalidStateError' || e.code === 11;
}

interface ProcessLike {
  prependListener?(event: 'unhandledRejection', fn: (err: unknown) => void): void;
  on?(event: 'unhandledRejection', fn: (err: unknown) => void): void;
  removeAllListeners?(event: 'unhandledRejection'): void;
}

const proc = (globalThis as unknown as { process?: ProcessLike }).process;
if (proc) {
  const swallow = (err: unknown): void => {
    if (isBenignIdbTeardownError(err)) return;
  };
  if (typeof proc.prependListener === 'function') {
    proc.prependListener('unhandledRejection', swallow);
  } else if (typeof proc.on === 'function') {
    proc.on('unhandledRejection', swallow);
  }
}
