import type { HTMLAttributes, ReactNode } from 'react';

type Severity = 'high' | 'medium' | 'low' | 'info';
type BadgeVariant = 'severity' | 'outline' | 'mono';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  severity?: Severity;
  children: ReactNode;
}

// Wave 45-A — severity variant follows DESIGN.md §5: tinted bg + ink-on-tint
// foreground + matching low-alpha border + 16px inline icon + text label.
// Mirrors the canonical pattern used in SeverityOverridesPanel.tsx (the
// going-forward severity treatment).
const SEVERITY_CLASSES: Record<Severity, string> = {
  high: 'bg-[var(--color-severity-bg-error)] text-fg border border-[var(--color-severity-border-error)]',
  medium:
    'bg-[var(--color-severity-bg-warn)] text-fg border border-[var(--color-severity-border-warn)]',
  low: 'bg-[var(--color-severity-bg-low)] text-fg border border-[var(--color-severity-border-low)]',
  info: 'bg-[var(--color-severity-bg-info)] text-fg border border-[var(--color-severity-border-info)]',
};

// Wave 53-C — distinct glyph family per handoff (docs/design_handoff_leaseguard
// /app-shell.jsx :: SeverityIcon). Each severity gets a different SHAPE so the
// icon is legible without color: triangle / diamond / circle / square.
// 16px inline SVG, aria-hidden — the visible label carries the meaning;
// stroke = currentColor so the icon inherits the badge text-fg.
function SeverityIcon({ severity }: { severity: Severity }): JSX.Element {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (severity) {
    case 'high':
      // Triangle (warn).
      return (
        <svg {...common}>
          <path d="M8 2 L14.5 13.5 H1.5 Z" />
          <path d="M8 6.5 V9.5 M8 11.3 V11.6" strokeLinecap="round" />
        </svg>
      );
    case 'medium':
      // Diamond with center dot.
      return (
        <svg {...common}>
          <path d="M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z" />
          <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'low':
      // Circle outline.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
        </svg>
      );
    case 'info':
      // Square.
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="11" height="11" />
        </svg>
      );
  }
}

export function Badge({
  variant = 'outline',
  severity,
  className = '',
  children,
  ...rest
}: BadgeProps): JSX.Element {
  if (variant === 'severity' && severity) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-small font-sans font-semibold tracking-[0.01em] ${SEVERITY_CLASSES[severity]} ${className}`}
        {...rest}
      >
        <SeverityIcon severity={severity} />
        {children}
      </span>
    );
  }
  let variantClass = '';
  if (variant === 'severity') {
    // severity variant without a severity prop — neutral pill (legacy fallback)
    variantClass = 'bg-rule text-fg-muted rounded-full px-2 py-0.5 text-small font-sans';
  } else if (variant === 'outline') {
    variantClass =
      'border border-rule text-fg-muted rounded-full px-2 py-0.5 text-small font-sans bg-transparent';
  } else {
    // mono
    variantClass = 'font-mono text-mono text-fg-muted';
  }
  return (
    <span className={`inline-flex items-center ${variantClass} ${className}`} {...rest}>
      {children}
    </span>
  );
}
