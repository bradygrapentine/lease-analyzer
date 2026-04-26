import type { ReactNode } from 'react';
import { useState } from 'react';
import { Card } from './Card';

export interface SectionGroupProps {
  /** Heading shown in the group header. */
  title: string;
  /** Optional badge after the title (e.g., "8 leases", "3 pending"). */
  count?: number | string;
  /** Whether the group is open by default. State is in-memory only. */
  defaultOpen?: boolean;
  /** Visual density. "comfortable" (default) or "compact". */
  density?: 'comfortable' | 'compact';
  /** Stable id used for the disclosure region's aria controls. */
  id: string;
  children: ReactNode;
}

/**
 * Collapsible group container with a header, optional count badge, and
 * disclosure affordance. State is in-memory only (per Wave 28 §1.2).
 */
export function SectionGroup({
  title,
  count,
  defaultOpen = false,
  density = 'comfortable',
  id,
  children,
}: SectionGroupProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;
  const headerPad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const bodyPad = density === 'compact' ? 'px-3 pb-3' : 'px-4 pb-4';

  return (
    <Card data-density={density} className="overflow-hidden">
      <h3 className="m-0">
        <button
          id={headerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
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
      </h3>
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
