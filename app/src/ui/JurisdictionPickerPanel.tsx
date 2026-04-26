// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="jurisdictions"              (section, both branches)
//   aria-label={`jurisdiction ${code}`}     (checkbox input)
//   id="jurisdiction-help"                  (p)
//   aria-describedby="jurisdiction-help"    (ul)
//   aria-label="clear jurisdiction selection" (button)
//
import type { ChangeEvent } from 'react';
import { Section } from './system/Section';
import { Button } from './system/Button';

interface JurisdictionPickerPanelProps {
  /** Jurisdiction codes available to pick from (e.g. `"US-CA"`). */
  available: string[];
  /**
   * Currently-selected subset. An empty array means "no filter active" —
   * every rule runs, regardless of its `jurisdictions` tag. That semantic
   * matches `filterByJurisdiction` in `rules/jurisdictions.ts`.
   */
  selected: string[];
  onChange: (next: string[]) => void;
}

export function JurisdictionPickerPanel({
  available,
  selected,
  onChange,
}: JurisdictionPickerPanelProps): JSX.Element {
  const selectedSet = new Set(selected);

  function toggle(code: string, checked: boolean): void {
    // Preserve input order of `available` so callers get stable output.
    const nextSet = new Set(selectedSet);
    if (checked) nextSet.add(code);
    else nextSet.delete(code);
    const next = available.filter((c) => nextSet.has(c));
    onChange(next);
  }

  function clearAll(): void {
    if (selected.length === 0) return;
    onChange([]);
  }

  if (available.length === 0) {
    return (
      <Section label="jurisdictions" className="space-y-2 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">Jurisdictions</h2>
        <p className="text-body text-fg-muted">
          <em>No jurisdictions available.</em>
        </p>
      </Section>
    );
  }

  return (
    <Section label="jurisdictions" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Jurisdictions</h2>
      <p id="jurisdiction-help" className="text-small text-fg-muted">
        {selected.length === 0
          ? 'No jurisdictions selected — all rules run regardless of regional tags.'
          : `${selected.length} selected. Only rules tagged with a selected jurisdiction (or untagged rules) will run.`}
      </p>
      <ul aria-describedby="jurisdiction-help" className="flex flex-wrap gap-2">
        {available.map((code) => {
          const checked = selectedSet.has(code);
          return (
            <li key={code}>
              <label className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-small cursor-pointer transition-colors ${checked ? 'bg-ink text-paper border-ink' : 'bg-paper-raised text-fg-body border-rule hover:bg-paper-sunken'}`}>
                <input
                  type="checkbox"
                  aria-label={`jurisdiction ${code}`}
                  checked={checked}
                  className="sr-only"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    toggle(code, e.target.checked)
                  }
                />
                <span>{code}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearAll}
        disabled={selected.length === 0}
        aria-label="clear jurisdiction selection"
      >
        Clear selection
      </Button>
    </Section>
  );
}

export type { JurisdictionPickerPanelProps };
