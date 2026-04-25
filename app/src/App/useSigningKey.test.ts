import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSigningKey } from './useSigningKey';
import { _resetSigningDbForTests } from '../security/signingKeys';

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

  it('exportKeyToClipboard swallows clipboard failures', async () => {
    const { result } = renderHook(() => useSigningKey());
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await expect(result.current.exportKeyToClipboard('pkbase64')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('pkbase64');
  });
});
