import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

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
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ' +
    'focus-visible:focus-ring',
  ghost:
    'bg-transparent text-fg-body hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ' +
    'focus-visible:focus-ring',
  subtle:
    'bg-paper-sunken text-fg-body border border-rule hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ' +
    'focus-visible:focus-ring',
};
// Wave 29-E — size tokens tuned to WCAG 2.5.5 AAA / 2.5.8 AA tap-target
// minimums. `md` (default) is 44×44 logical px (h-11 + min-w-11 fallback
// covers icon-only cases); `sm` is 32×32 for dense toolbars where the
// tap-target relaxation is acceptable (compact-cluster exception). Both
// sizes ship `min-w` so square / icon-only buttons still meet the
// minimum even with short labels.
const SIZE: Record<Size, string> = {
  sm: 'h-8 min-w-8 px-2 text-small rounded-sm',
  md: 'h-11 min-w-11 px-3 text-body rounded-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', pressed, className = '', type = 'button', ...rest },
  ref,
) {
  const pressedClass = pressed ? 'ring-1 ring-inset ring-ink' : '';
  // Wave 29-E — when consumers override `role` (e.g. `role="tab"` on
  // the view-mode tablist), `aria-pressed` is not an allowed attribute
  // for that role and axe flags it. Drop `aria-pressed` when an
  // explicit role is supplied; the consumer is responsible for the
  // appropriate state attribute (`aria-selected`, `aria-checked`, …).
  const explicitRole =
    'role' in rest && typeof (rest as { role?: unknown }).role === 'string';
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={explicitRole ? undefined : pressed}
      className={`inline-flex items-center justify-center font-sans transition-colors ${VARIANT[variant]} ${SIZE[size]} ${pressedClass} ${className}`}
      {...rest}
    />
  );
});
