import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
// Wave 9 Part A — module does not exist yet; failing import is the red
// signal. The implementer creates `app/src/App/useReviewMode.ts`
// exporting a hook + provider with this shape:
//
//   type ReviewMode =
//     | { active: true; archiveId: string; expiresAt: string }
//     | { active: false };
//
//   export function useReviewMode(): {
//     mode: ReviewMode;
//     enter(args: { archiveId: string; expiresAt: string }): void;
//     exit(): void;
//   };
//
//   export function ReviewModeProvider(props: { children: React.ReactNode }):
//     JSX.Element;
import { useReviewMode, ReviewModeProvider } from './useReviewMode';

describe('useReviewMode', () => {
  it('defaults to inactive when no provider state has been set', () => {
    const { result } = renderHook(() => useReviewMode(), { wrapper: ReviewModeProvider });
    expect(result.current.mode.active).toBe(false);
  });

  it('enter() sets active=true with archiveId + expiresAt; exit() returns to inactive', () => {
    const { result } = renderHook(() => useReviewMode(), { wrapper: ReviewModeProvider });
    act(() => {
      result.current.enter({ archiveId: 'arch-1', expiresAt: '2099-01-01T00:00:00Z' });
    });
    expect(result.current.mode).toEqual({
      active: true,
      archiveId: 'arch-1',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    act(() => {
      result.current.exit();
    });
    expect(result.current.mode.active).toBe(false);
  });

  it('returns a safe inactive fallback when used outside the provider', () => {
    // Exercises the provider-absent branch — panels that call useReviewMode
    // without a wrapping ReviewModeProvider must get mode.active===false
    // rather than throwing, so isolated panel tests don't need the provider.
    const { result } = renderHook(() => useReviewMode());
    expect(result.current.mode.active).toBe(false);
    // enter/exit are no-ops outside the provider — calling them must not throw.
    expect(() => {
      act(() => {
        result.current.enter({ archiveId: 'x', expiresAt: '2099-01-01T00:00:00Z' });
        result.current.exit();
      });
    }).not.toThrow();
  });
});
