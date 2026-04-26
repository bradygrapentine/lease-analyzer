import type { HTMLAttributes, ReactNode } from 'react';

type Severity = 'high' | 'medium' | 'low' | 'info';
type BadgeVariant = 'severity' | 'outline' | 'mono';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  severity?: Severity;
  children: ReactNode;
}

const SEVERITY_CLASSES: Record<Severity, string> = {
  high: 'bg-severity-high/10 text-severity-high',
  medium: 'bg-severity-medium/10 text-severity-medium',
  low: 'bg-severity-low/10 text-severity-low',
  info: 'bg-severity-info/10 text-severity-info',
};

export function Badge({
  variant = 'outline',
  severity,
  className = '',
  children,
  ...rest
}: BadgeProps): JSX.Element {
  let variantClass = '';
  if (variant === 'severity' && severity) {
    variantClass = `${SEVERITY_CLASSES[severity]} rounded-full px-2 py-0.5 text-small font-sans`;
  } else if (variant === 'severity') {
    // severity variant without a severity prop — neutral pill
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
