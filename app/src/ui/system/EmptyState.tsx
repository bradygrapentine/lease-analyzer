import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /**
   * Lucide-style glyph as inline SVG. We do NOT pull in lucide-react;
   * pass the SVG element directly. Rendered at 32px and aria-hidden by
   * convention (caller controls).
   */
  icon?: ReactNode;
  action?: ReactNode;
}

/**
 * Centered empty-state placeholder used by panels with no rows.
 * Uses the muted-foreground tokens; icon slot is rendered at 32 px.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center text-fg-muted">
      {icon && (
        <div data-empty-icon className="mb-1 h-8 w-8 text-fg-faint">
          {icon}
        </div>
      )}
      <p className="text-body font-sans text-fg m-0">{title}</p>
      {description && (
        <p
          data-empty-description
          className="text-small font-sans text-fg-muted m-0 max-w-prose"
        >
          {description}
        </p>
      )}
      {action && (
        <div data-empty-action className="mt-3">
          {action}
        </div>
      )}
    </div>
  );
}
