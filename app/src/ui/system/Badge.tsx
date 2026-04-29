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

function SeverityIcon({ severity }: { severity: Severity }): JSX.Element {
  // 16px inline SVG, aria-hidden — the visible label carries the meaning.
  // Glyph per severity: high=triangle-exclamation, medium=circle-exclamation,
  // low=circle-dot, info=circle-i. Stroke is currentColor so the icon
  // inherits the text-fg foreground.
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (severity) {
    case 'high':
      return (
        <svg {...common}>
          <path d="M8 1.75 14.5 13.5h-13z" />
          <path d="M8 6.25v3.5" />
          <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'medium':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 4.75v3.5" />
          <circle cx="8" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'low':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.25" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
          <path d="M8 7.25v4" />
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
