import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'ghost' | 'subtle';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Toggle-pill state. When `true`, button gets the "pressed" visual
   * + `aria-pressed="true"`. Used for severity / category filters in
   * FindingsPanel that already use `aria-pressed`.
   */
  pressed?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  default:
    'bg-ink text-paper hover:bg-ink/90 active:bg-ink/80 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
  ghost:
    'bg-transparent text-fg-body hover:bg-paper-sunken ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
  subtle:
    'bg-paper-sunken text-fg-body border border-rule hover:bg-paper-raised ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
};
const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2 text-small rounded-sm',
  md: 'h-9 px-3 text-body rounded',
};

export function Button({
  variant = 'default',
  size = 'md',
  pressed,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const pressedClass = pressed ? 'ring-1 ring-inset ring-ink' : '';
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`inline-flex items-center justify-center font-sans transition-colors ${VARIANT[variant]} ${SIZE[size]} ${pressedClass} ${className}`}
      {...rest}
    />
  );
}
