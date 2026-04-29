import type { HTMLAttributes, ReactNode, ElementType } from 'react';

type SeverityVariant = 'severity-high' | 'severity-medium' | 'severity-low' | 'severity-info';
type CardVariant = 'default' | SeverityVariant;

interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * Tinted-row severity variant. Paints the card background with the
   * matching severity-bg token and replaces the default 1px Margin Rule
   * border with the severity-border token (full perimeter, NOT a side
   * stripe). Pair with a leading `<Badge variant="severity" severity=…>`
   * inside the card so the row carries icon + label per DESIGN.md §5.
   */
  variant?: CardVariant;
  /**
   * Override the rendered element. Defaults to `<article>` when `aria-label`
   * is set (preserving SelectedFinding semantics), otherwise `<div>`.
   */
  as?: ElementType;
  children: ReactNode;
}

// Wave 45-A — severity variant uses tinted bg + matching low-alpha border
// (full perimeter, not a side stripe). Replaces the legacy 3px border-l
// accent that violated DESIGN.md Don't #1 ("no side-stripe borders > 1px").
const SEVERITY_VARIANT: Record<SeverityVariant, string> = {
  'severity-high':
    'bg-[var(--color-severity-bg-error)] border border-[var(--color-severity-border-error)]',
  'severity-medium':
    'bg-[var(--color-severity-bg-warn)] border border-[var(--color-severity-border-warn)]',
  'severity-low':
    'bg-[var(--color-severity-bg-low)] border border-[var(--color-severity-border-low)]',
  'severity-info':
    'bg-[var(--color-severity-bg-info)] border border-[var(--color-severity-border-info)]',
};

const DEFAULT_VARIANT = 'bg-paper-raised border border-rule';

export function Card({
  variant = 'default',
  as,
  className = '',
  children,
  ...rest
}: CardProps): JSX.Element {
  // Default element: article when aria-label is present, div otherwise.
  const Tag = (as ?? (rest['aria-label'] ? 'article' : 'div')) as ElementType;
  const variantClass = variant === 'default' ? DEFAULT_VARIANT : SEVERITY_VARIANT[variant];
  return (
    <Tag className={`shadow-paper rounded-sm ${variantClass} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
