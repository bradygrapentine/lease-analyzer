import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFocusTrap } from './useFocusTrap';

interface DialogProps {
  open: boolean;
  onDismiss: () => void;
  /** aria-labelledby target. Required for accessible name. */
  titleId: string;
  /** aria-describedby target, optional. */
  descriptionId?: string;
  /**
   * Initial focus target on mount. Defaults to the dialog root (which is
   * tabIndex={-1} so it can receive focus programmatically).
   */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Whether Esc dismisses. Default: true. */
  closeOnEscape?: boolean;
  /**
   * Backdrop click dismiss. Default: false. LeaseGuard is a lawyerly app;
   * dialogs are not consumer-soft "tap-anywhere-to-close" surfaces.
   */
  closeOnBackdropClick?: boolean;
  className?: string;
  children: ReactNode;
}

// Wave 45-F — codifies the WAI-ARIA APG dialog contract: focus trap,
// initial focus, return focus, Esc handler, focus ring, reduced-motion
// honored. Used today by OnboardingTour; future dialogs inherit the
// contract by construction.
export function Dialog({
  open,
  onDismiss,
  titleId,
  descriptionId,
  initialFocusRef,
  closeOnEscape = true,
  closeOnBackdropClick = false,
  className = '',
  children,
}: DialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Focus trap inside the dialog while open.
  useFocusTrap(dialogRef, open);

  // Wave 46 Item D — apply `inert` to body siblings while open. The focus
  // trap governs Tab cycling; `inert` blocks programmatic .focus() and
  // pointer interaction from outside the dialog (e.g. the App `/` and
  // Cmd+F shortcuts that .focus() the search input directly). We track
  // which siblings we toggled so cleanup does not stomp siblings that
  // were already inert for unrelated reasons.
  useEffect(() => {
    if (!open) return;
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    const toggled: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(dialogEl)) continue;
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      toggled.push(child);
    }
    return () => {
      for (const el of toggled) {
        el.removeAttribute('inert');
      }
    };
  }, [open]);

  // Esc handler.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onDismiss]);

  // Initial focus + return focus.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const target = initialFocusRef?.current ?? dialogRef.current;
    if (target) {
      // Defer one microtask so the DOM is mounted before focus moves.
      Promise.resolve().then(() => target.focus());
    }
    return () => {
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (!closeOnBackdropClick) return;
    if (e.target === e.currentTarget) onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 p-4 motion-dialog-backdrop"
      onClick={onBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`bg-paper-raised border border-rule rounded-sm shadow-paper p-4 max-w-lg w-full focus-visible:focus-ring motion-dialog-in ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
