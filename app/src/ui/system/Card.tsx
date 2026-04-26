import type { HTMLAttributes, ReactNode, ElementType } from 'react';

type Accent = 'high' | 'medium' | 'low' | 'info';

interface CardProps extends HTMLAttributes<HTMLElement> {
  accent?: Accent;
  /**
   * Override the rendered element. Defaults to `<article>` when `aria-label`
   * is set (preserving SelectedFinding semantics), otherwise `<div>`.
   */
  as?: ElementType;
  children: ReactNode;
}

const ACCENT_BORDER: Record<Accent, string> = {
  high: 'border-l-[3px] border-l-severity-high',
  medium: 'border-l-[3px] border-l-severity-medium',
  low: 'border-l-[3px] border-l-severity-low',
  info: 'border-l-[3px] border-l-severity-info',
};

export function Card({
  accent,
  as,
  className = '',
  children,
  ...rest
}: CardProps): JSX.Element {
  // Default element: article when aria-label is present, div otherwise.
  const Tag = (as ?? (rest['aria-label'] ? 'article' : 'div')) as ElementType;
  const accentClass = accent ? ACCENT_BORDER[accent] : '';
  return (
    <Tag
      className={`bg-paper-raised shadow-paper rounded-sm border border-rule ${accentClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
