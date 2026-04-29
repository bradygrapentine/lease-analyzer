import type { ReactNode } from 'react';
import { useState } from 'react';
import { Card } from './Card';
import { readAccordionState, writeAccordionState } from './accordionStorage';

export interface SectionGroupProps {
  /**
   * Initial open state when no persisted preference exists. Wave 30
   * Part B reversed the Wave 28 §1.2 default to `false` (collapsed) —
   * a stored `localStorage` preference always wins over this.
   */
  title: string;
  /** Optional badge after the title (e.g., "8 leases", "3 pending"). */
  count?: number | string;
  /**
   * Whether the group is open by default when no `localStorage`
   * preference is set. Defaults to `false` per Wave 30 Part B.
   */
  defaultOpen?: boolean;
  /** Visual density. "comfortable" (default) or "compact". */
  density?: 'comfortable' | 'compact';
  /**
   * Stable id used for the disclosure region's aria controls AND for
   * the `lg.accordion.<id>.open` localStorage key.
   */
  id: string;
  children: ReactNode;
}

/**
 * Collapsible group container with a header, optional count badge, and
 * disclosure affordance. Per-section open/closed state is persisted in
 * `localStorage` (key `lg.accordion.<id>.open`); presence of the key
 * wins over `defaultOpen` (Wave 30 §1.4). On servers / SSR / jsdom
 * without storage, behavior falls back to the in-memory default.
 */
export function SectionGroup({
  title,
  count,
  defaultOpen = false,
  density = 'comfortable',
  id,
  children,
}: SectionGroupProps): JSX.Element {
  // Initialize from storage when available so the first paint already
  // reflects the user's last choice; SPA, no SSR, so no post-mount
  // reconciliation needed.
  const [open, setOpen] = useState<boolean>(() => readAccordionState(id) ?? defaultOpen);

  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;
  const headerPad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const bodyPad = density === 'compact' ? 'px-3 pb-3' : 'px-4 pb-4';

  const handleToggle = (): void => {
    setOpen((v) => {
      const next = !v;
      writeAccordionState(id, next);
      return next;
    });
  };

  return (
    <Card data-density={density} className="overflow-hidden">
      {/* h2 (Wave 41): the disclosure header sits directly under the page h1. h3 here skipped a level → axe heading-order. */}
      <h2 className="m-0">
        <button
          id={headerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={handleToggle}
          className={`flex w-full items-center justify-between gap-3 text-heading uppercase font-sans text-fg-muted hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] focus-visible:focus-ring ${headerPad}`}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block w-3">
              {open ? '▾' : '▸'}
            </span>
            <span>{title}</span>
            {count !== undefined && (
              <span
                data-section-count
                className="inline-flex items-center rounded-full border border-rule px-2 py-0.5 text-small font-sans text-fg-muted bg-paper-sunken"
              >
                {count}
              </span>
            )}
          </span>
        </button>
      </h2>
      {/*
        Wave 28 Part C bugfix: aria-labelledby now points to the disclosure
        button (which carries the title) rather than the panel's own id.
        Wave 28 Part F (a11y sweep): dropped `role="region"` on the panel —
        the disclosure pattern (button[aria-expanded][aria-controls] +
        panel[hidden]) is sufficient for AT. Promoting the panel to a
        landmark region collided with descendant Section landmarks
        (e.g. LibraryPanel's `<section aria-label="library">` matches the
        outer "Library" disclosure's accessible name → axe
        landmark-unique violation). aria-labelledby is retained so
        readers still announce the group title when focus enters.
      */}
      <div id={panelId} aria-labelledby={headerId} hidden={!open} className={open ? bodyPad : ''}>
        {open && children}
      </div>
    </Card>
  );
}
