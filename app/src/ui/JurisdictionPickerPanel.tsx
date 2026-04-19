import type { ChangeEvent } from 'react';

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
      <section aria-label="jurisdictions">
        <h2>Jurisdictions</h2>
        <p>
          <em>No jurisdictions available.</em>
        </p>
      </section>
    );
  }

  return (
    <section aria-label="jurisdictions">
      <h2>Jurisdictions</h2>
      <p id="jurisdiction-help">
        {selected.length === 0
          ? 'No jurisdictions selected — all rules run regardless of regional tags.'
          : `${selected.length} selected. Only rules tagged with a selected jurisdiction (or untagged rules) will run.`}
      </p>
      <ul aria-describedby="jurisdiction-help">
        {available.map((code) => {
          const checked = selectedSet.has(code);
          return (
            <li key={code}>
              <label>
                <input
                  type="checkbox"
                  aria-label={`jurisdiction ${code}`}
                  checked={checked}
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
      <button
        type="button"
        onClick={clearAll}
        disabled={selected.length === 0}
        aria-label="clear jurisdiction selection"
      >
        Clear selection
      </button>
    </section>
  );
}

export type { JurisdictionPickerPanelProps };
