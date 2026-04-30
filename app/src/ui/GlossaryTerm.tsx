import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  term: string;
  definition: string;
  /** Source of the definition — controls the visual treatment. */
  source?: 'lease' | 'glossary';
  /**
   * When `false`, render a non-focusable `<span>` instead of a focusable
   * `<button>`. Use this when the term lives inside an outer `<button>`
   * (e.g. FindingsPanel's `.finding-btn` snippet) — nested interactive
   * controls are an axe `nested-interactive` violation. The hover popover
   * still works; keyboard users reach the definition via the modal that
   * the outer button opens.
   */
  interactive?: boolean;
  children: ReactNode;
}

/**
 * Wave 51-E — keyboard-accessible glossary popover. Replaces the inline
 * `<dfn title="…">` native tooltip with a real focusable trigger + styled
 * popover so users can:
 *
 *   - Hover to peek (mouse).
 *   - Tab to the term → popover opens (keyboard).
 *   - Esc closes the popover and restores focus to the trigger.
 *   - Screen readers see the popover via `aria-describedby`.
 *
 * Per plan §1.7: hover OR focus opens; Esc closes; aria-describedby ties
 * trigger to popover.
 */
export function GlossaryTerm({
  term,
  definition,
  source = 'lease',
  interactive = true,
  children,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open || !interactive) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, interactive]);

  const sharedClass =
    'inline underline decoration-dotted underline-offset-[3px] ' +
    (source === 'glossary' ? 'text-fg-muted' : 'text-fg-body');

  const popover = open ? (
    <span
      id={popoverId}
      role="tooltip"
      className="absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-sm bg-fg p-2.5 font-sans text-paper text-[12px] leading-snug shadow-paper"
    >
      <span className="block font-semibold mb-0.5">{term}</span>
      <span className="block text-paper-sunken">{definition}</span>
    </span>
  ) : null;

  if (!interactive) {
    // Non-focusable span — used when the term lives inside an outer button.
    return (
      <span
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className={sharedClass}>{children}</span>
        {popover}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`${sharedClass} cursor-help border-0 bg-transparent p-0`}
      >
        {children}
      </button>
      {popover}
    </span>
  );
}
