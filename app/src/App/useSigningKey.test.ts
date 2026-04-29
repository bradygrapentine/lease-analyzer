import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSigningKey } from './useSigningKey';
import { _resetSigningDbForTests } from '../security/signingKeys';

// Swallow benign IDB teardown rejections (InvalidStateError / code 11)
// that fire when a fire-and-forget refresh resolves after the next
// test's beforeEach nulls the cached db promise. Mirrors the guard in
// App.test.tsx.
function isBenignIdbTeardownError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null;
  if (!e) return false;
  if (e.name === 'InvalidStateError') return true;
  if (e.code === 11) return true;
  return false;
}
interface NodeProcessLike {
  on(event: 'unhandledRejection', fn: (err: unknown) => void): void;
  off(event: 'unhandledRejection', fn: (err: unknown) => void): void;
}
const proc = (globalThis as unknown as { process?: NodeProcessLike }).process;
const onUnhandled = (err: unknown): void => {
  if (!isBenignIdbTeardownError(err)) throw err as Error;
};
beforeAll(() => {
  proc?.on('unhandledRejection', onUnhandled);
});
afterAll(() => {
  proc?.off('unhandledRejection', onUnhandled);
});

afterEach(async () => {
  cleanup();
  // Drain any in-flight `refresh` IDB reads from the just-unmounted hook
  // before the next test's `beforeEach` nulls the cached db promise.
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => setTimeout(r, 0));
});

beforeEach(async () => {
  _resetSigningDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-signing');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('useSigningKey', () => {
  it('initial mount reports no key, createKey populates publicKey', async () => {
    const { result } = renderHook(() => useSigningKey());
    await waitFor(() => {
      expect(result.current.publicKey).toBeNull();
    });
    await act(async () => {
      await result.current.createKey('correct horse battery staple');
    });
    expect(typeof result.current.publicKey).toBe('string');
    expect(result.current.publicKey).not.toBe('');
  });

  it('exportKeyToClipboard returns { status: "copied" } on success', async () => {
    const { result } = renderHook(() => useSigningKey());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await expect(result.current.exportKeyToClipboard('pkbase64')).resolves.toEqual({
      status: 'copied',
    });
    expect(writeText).toHaveBeenCalledWith('pkbase64');
  });

  it('exportKeyToClipboard returns { status: "denied", reason } when writeText rejects', async () => {
    const { result } = renderHook(() => useSigningKey());
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const out = await result.current.exportKeyToClipboard('pkbase64');
    expect(out).toEqual({ status: 'denied', reason: 'blocked' });
  });

  it('exportKeyToClipboard returns { status: "denied" } when the clipboard API is missing', async () => {
    const { result } = renderHook(() => useSigningKey());
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const out = await result.current.exportKeyToClipboard('pkbase64');
    expect(out.status).toBe('denied');
  });
});
