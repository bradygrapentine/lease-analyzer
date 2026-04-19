import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useEffect } from 'react';
import { useInViewport } from './useInViewport';

// The hook reads `globalThis.IntersectionObserver` at call time. jsdom
// doesn't ship one, so the default codepath is the "no observer" branch.
// We poke globalThis for the observer-present branch.

describe('useInViewport', () => {
  afterEach(() => {
    // Make sure we don't leak a stub between tests.
    const g = globalThis as { IntersectionObserver?: unknown };
    delete g.IntersectionObserver;
  });

  it('returns true by default when IntersectionObserver is undefined', () => {
    // Guarded: ensure jsdom doesn't already have one.
    expect(
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver,
    ).toBeUndefined();

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      // Attach a real element so the hook has something to "observe".
      useEffect(() => {
        // No DOM needed — the no-observer branch skips observe().
      }, []);
      return useInViewport(ref);
    });

    expect(result.current).toBe(true);
  });

  it('flips to observed intersection value when IntersectionObserver is available', () => {
    type Cb = (entries: IntersectionObserverEntry[]) => void;
    let lastCb: Cb | null = null;
    class StubObserver {
      cb: Cb;
      constructor(cb: Cb) {
        this.cb = cb;
        lastCb = cb;
      }
      observe(): void {
        // Start off-screen: hook default state is `false` when observer
        // exists, so we assert that transition separately below.
      }
      disconnect(): void {}
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      StubObserver as unknown as typeof IntersectionObserver;

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      // Attach a detached element to satisfy ref.current in useEffect.
      useEffect(() => {
        const div = document.createElement('div');
        (ref as { current: HTMLDivElement | null }).current = div;
      }, []);
      return useInViewport(ref);
    });

    // Observer-present branch starts false (we haven't intersected yet).
    expect(result.current).toBe(false);

    // Simulate an intersection event from the observer.
    act(() => {
      lastCb?.([
        { isIntersecting: true } as unknown as IntersectionObserverEntry,
      ]);
    });
    expect(result.current).toBe(true);

    // And back out again.
    act(() => {
      lastCb?.([
        { isIntersecting: false } as unknown as IntersectionObserverEntry,
      ]);
    });
    expect(result.current).toBe(false);
  });

  it('disconnects the observer on unmount', () => {
    const disconnect = vi.fn();
    class StubObserver {
      observe(): void {}
      disconnect = disconnect;
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      StubObserver as unknown as typeof IntersectionObserver;

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        (ref as { current: HTMLDivElement | null }).current =
          document.createElement('div');
      }, []);
      return useInViewport(ref);
    });

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
