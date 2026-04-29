import { useRef, type ReactNode } from 'react';

type Variant = 'default' | 'ghost' | 'subtle';
type Size = 'sm' | 'md';

interface FileButtonProps {
  /** Visible label inside the button. */
  children: ReactNode;
  /** Forwarded to the underlying input. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Variant + size matching Button. Defaults to subtle / md. */
  variant?: Variant;
  size?: Size;
  /** Called with the FileList when files are picked. */
  onFiles: (files: FileList) => void;
  /** Optional aria-describedby target. */
  'aria-describedby'?: string;
  /**
   * Accessible name. Required because the button forwards click to a
   * hidden input — screen readers should hear what the button does, not
   * just the visible decoration text.
   */
  'aria-label': string;
  className?: string;
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

const SIZE: Record<Size, string> = {
  sm: 'h-8 min-w-8 px-2 text-small rounded-sm',
  md: 'h-11 min-w-11 px-3 text-body rounded-sm',
};

// Wave 45-F — Button-sized file-input affordance. The VISIBLE <button> is
// the focus surface (gets the focus ring, keyboard activation, and
// accessible name); the <input type="file"> is hidden via display:none
// and triggered via ref.click() when the button is activated. This is
// the inverse of the naive sr-only-input pattern, which leaves focus
// invisible to sighted keyboard users.
export function FileButton({
  children,
  accept,
  multiple,
  disabled,
  variant = 'subtle',
  size = 'md',
  onFiles,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: FileButtonProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex items-center justify-center font-sans transition-colors ${VARIANT[variant]} ${SIZE[size]} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        // Hidden from layout AND tab order — the button is the focus
        // surface. tabIndex={-1} is belt-and-braces in case any future
        // browser exposes display:none inputs (none do today).
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (files && files.length > 0) {
            onFiles(files);
          }
          // Reset so picking the same file again still fires onChange.
          e.currentTarget.value = '';
        }}
      />
    </>
  );
}
