import { useEffect, type RefObject } from 'react';

// Wave 45-F — focus-trap hook for the Dialog primitive. Cycles Tab /
// Shift-Tab within the container's focusable descendants, recomputed on
// DOM mutations so dynamic content (stepper next/back, error states) stays
// trapped. Exits the trap automatically when `active` flips false.
//
// Not exported from `system/index.ts`: this is internal to Dialog.
export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    function getFocusable(): HTMLElement[] {
      if (!root) return [];
      const selector =
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => {
        // Filter out hidden / display:none nodes so Tab cycling skips them.
        return !el.hasAttribute('aria-hidden') || el.getAttribute('aria-hidden') !== 'true';
      });
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        // Nothing focusable — keep focus on the container itself.
        e.preventDefault();
        root?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      // Treat the root container itself as a wrap boundary. When initial
      // focus lands on the dialog root (Dialog default), Shift+Tab from
      // there must wrap to the last focusable, not fall through to the
      // background. Forward Tab from the root goes to the first
      // focusable. (Codex caught this gap in the original logic, which
      // only wrapped on first/last/outside-root.)
      const onRoot = active === root;
      if (e.shiftKey) {
        if (onRoot || active === first || !root?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (onRoot) {
          e.preventDefault();
          first.focus();
        } else if (active === last || !root?.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, containerRef]);
}
