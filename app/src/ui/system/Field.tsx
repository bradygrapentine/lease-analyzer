import type { HTMLAttributes, ReactNode, ElementType } from 'react';

type FieldElement = 'input' | 'textarea' | 'select';

interface FieldProps extends HTMLAttributes<HTMLElement> {
  label: string;
  as?: FieldElement;
  description?: string;
  children?: ReactNode;
  // Allow all native element attributes to pass through
  [key: string]: unknown;
}

export function Field({
  label,
  as: Tag = 'input',
  description,
  className = '',
  children,
  ...rest
}: FieldProps): JSX.Element {
  const descId = description ? `field-desc-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined;
  const InnerTag = Tag as ElementType;
  return (
    <label className={`flex flex-col gap-1 text-body font-sans text-fg-body ${className}`}>
      <span className="text-small text-fg-muted">{label}</span>
      {description && (
        <span id={descId} className="text-small text-fg-faint">
          {description}
        </span>
      )}
      <InnerTag
        aria-describedby={descId}
        className="border border-rule rounded bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
        {...rest}
      >
        {children}
      </InnerTag>
    </label>
  );
}
