import { useEffect, useState, type RefObject } from 'react';

/**
 * Observe whether `ref.current` intersects the viewport (or a scroll root)
 * using IntersectionObserver.
 *
 * Fallback: if `IntersectionObserver` is undefined (e.g., jsdom), returns
 * `true` — i.e., treat every element as visible. This keeps existing tests
 * passing and keeps the pre-virtualization DOM output identical in
 * non-observing environments.
 *
 * Additive / Phase 13. No behavior change to callers that do not opt in.
 */
export interface UseInViewportOptions {
  /**
   * CSS margin expanded around the root when computing intersections.
   * Defaults to "200px 0px" so items just outside the viewport are
   * pre-mounted — the "observer radius" — avoiding visible pop-in during
   * normal scroll.
   */
  rootMargin?: string;
  /** Intersection threshold; defaults to 0 (any pixel visible). */
  threshold?: number | number[];
  /** Optional scroll root (null = viewport). */
  root?: Element | null;
}

export function useInViewport<T extends Element>(
  ref: RefObject<T>,
  options: UseInViewportOptions = {},
): boolean {
  // Fallback default: jsdom / old browsers lack IntersectionObserver, so
  // we treat the item as always visible. This also covers SSR and first
  // paint before the observer attaches.
  const hasObserver =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver !==
      'undefined';

  const [inView, setInView] = useState<boolean>(!hasObserver);

  const { rootMargin = '200px 0px', threshold = 0, root = null } = options;

  useEffect(() => {
    if (!hasObserver) return;
    const el = ref.current;
    if (!el) return;
    const IO = (
      globalThis as unknown as {
        IntersectionObserver: new (
          cb: (entries: IntersectionObserverEntry[]) => void,
          init?: IntersectionObserverInit,
        ) => IntersectionObserver;
      }
    ).IntersectionObserver;
    const observer = new IO(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { root, rootMargin, threshold },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref, hasObserver, root, rootMargin, threshold]);

  return inView;
}
