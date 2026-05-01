import type { HTMLAttributes, ReactNode } from 'react';

// Wave 58a Slice 1 — `<StatusMessage>` primitive.
// Codifies the ~17 ad-hoc `<p role="status|alert">` one-liners scattered
// across panels into a single, audit-friendly surface. No new tokens —
// every tone reuses an existing color from `app/src/index.css` so a
// migration to this primitive is a pure recipe-swap.
//
// Role mapping per WAI-ARIA: `error` is assertive (`role="alert"`), every
// other tone is the polite live region (`role="status"`). Components that
// need a non-default `aria-live` can pass it through as a regular prop.

export type StatusTone = 'success' | 'error' | 'info' | 'warn';

interface StatusMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  tone: StatusTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  // success → positive ink (Wave 45-A token, used by OpenReviewPanel /
  // PackManagerPanel today).
  success: 'text-small text-positive',
  // error → severity-high ink. Matches PackManagerPanel + ScannedPdfNotice
  // one-liners.
  error: 'text-small text-severity-high',
  // info → muted ink for low-stakes status (e.g. SigningKeyPanel hint
  // lines, BulkImportPanel summary).
  info: 'text-small text-fg-muted',
  // warn → severity-medium ink for warning-grade status that doesn't yet
  // warrant a full severity surface.
  warn: 'text-small text-severity-medium',
};

export function StatusMessage({
  tone,
  className = '',
  children,
  ...rest
}: StatusMessageProps): JSX.Element {
  const role = tone === 'error' ? 'alert' : 'status';
  const toneClass = TONE_CLASSES[tone];
  return (
    <p role={role} className={`${toneClass} ${className}`.trim()} {...rest}>
      {children}
    </p>
  );
}
