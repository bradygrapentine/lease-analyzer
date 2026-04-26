import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface BaseProps {
  label: string;
  description?: ReactNode;
}

type InputFieldProps = BaseProps & { as?: 'input' } & Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>;
type TextareaFieldProps = BaseProps & { as: 'textarea' } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'>;
type SelectFieldProps = BaseProps & { as: 'select'; children: ReactNode } & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>;

type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function Field({
  label,
  as: Tag = 'input',
  description,
  className = '',
  ...rest
}: FieldProps): JSX.Element {
  const reactId = useId();
  const descId = description ? `${reactId}-desc` : undefined;

  if (Tag === 'select') {
    const { children, ...selectRest } = rest as Omit<SelectFieldProps, 'label' | 'as' | 'description' | 'className'>;
    return (
      <label className={`flex flex-col gap-1 text-body font-sans text-fg-body ${className}`}>
        <span className="text-small text-fg-muted">{label}</span>
        {description && (
          <span id={descId} className="text-small text-fg-faint">
            {description}
          </span>
        )}
        <select
          aria-describedby={descId}
          className="border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
          {...(selectRest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {children}
        </select>
      </label>
    );
  }

  if (Tag === 'textarea') {
    return (
      <label className={`flex flex-col gap-1 text-body font-sans text-fg-body ${className}`}>
        <span className="text-small text-fg-muted">{label}</span>
        {description && (
          <span id={descId} className="text-small text-fg-faint">
            {description}
          </span>
        )}
        <textarea
          aria-describedby={descId}
          className="border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      </label>
    );
  }

  return (
    <label className={`flex flex-col gap-1 text-body font-sans text-fg-body ${className}`}>
      <span className="text-small text-fg-muted">{label}</span>
      {description && (
        <span id={descId} className="text-small text-fg-faint">
          {description}
        </span>
      )}
      <input
        aria-describedby={descId}
        className="border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
        {...(rest as InputHTMLAttributes<HTMLInputElement>)}
      />
    </label>
  );
}
