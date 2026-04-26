import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';

interface SectionProps extends HTMLAttributes<HTMLElement> {
  label: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function Section({
  label,
  collapsible = false,
  defaultExpanded = true,
  className = '',
  children,
  ...rest
}: SectionProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (collapsible) {
    return (
      <section aria-label={label} className={className} {...rest}>
        <h2>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between text-heading uppercase font-sans text-fg-muted py-1"
          >
            {label}
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          </button>
        </h2>
        {expanded && <div>{children}</div>}
      </section>
    );
  }

  return (
    <section aria-label={label} className={className} {...rest}>
      {children}
    </section>
  );
}
