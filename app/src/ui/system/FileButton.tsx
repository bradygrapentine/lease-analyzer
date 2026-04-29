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
  /** Optional aria-label override; defaults to the visible children text. */
  'aria-label'?: string;
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

// Wave 45-F — Button-sized file-input affordance. Visually identical to
// <Button>, but a hidden <input type="file"> sits inside so click /
// keyboard activation opens the system file picker. Closes the four h-7
// (28px) reinvented file-input sites the audit flagged.
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
    <label
      className={`inline-flex items-center justify-center font-sans transition-colors cursor-pointer ${VARIANT[variant]} ${SIZE[size]} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      aria-disabled={disabled || undefined}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className="sr-only"
        onChange={(e) => {
          const files = e.currentTarget.files;
          if (files && files.length > 0) {
            onFiles(files);
          }
          // Reset so picking the same file again still fires onChange.
          e.currentTarget.value = '';
        }}
      />
    </label>
  );
}
