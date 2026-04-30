import { useState, type DragEvent } from 'react';
import { Button } from './system/Button';
import { useI18n } from '../i18n/I18nContext';

// Aria/data inventory:
//   aria-label="upload lease" (input — preserved verbatim from the
//     pre-Wave-51-A AppHeader so existing tests + screen readers
//     keep finding the upload affordance)
//   role="region" + aria-label="upload" (section root)
//
// Wave 51-B — annotated landing for the empty / first-run state.
// Adopted from the Claude Design handoff (`app-shell.jsx > UploadView`).
// Left column is the editorial pitch + drop-zone row + footer chips;
// right column is the "what you'll see" sample preview. Renders only
// when `status.kind === 'idle'`; once a lease is loading or analyzed
// the AppCurrentPane swaps to the loading / results layout.

interface UploadViewProps {
  onUpload: (file: File) => void | Promise<void>;
  onTrySample: () => void | Promise<void>;
}

// NOTE: kept abstract — must NOT contain real rule excerpts (e.g.
// "auto-renewal", "waiver of jury trial") because App-level tests
// `waitFor` on those sentinels and would short-circuit on this
// preview before the real analysis completes.
const SAMPLE_PREVIEW: ReadonlyArray<{
  severity: 'high' | 'medium' | 'low';
  label: string;
  text: string;
}> = [
  {
    severity: 'high',
    label: 'High',
    text: 'Renewal clauses that lock you in past your notice window.',
  },
  {
    severity: 'high',
    label: 'High',
    text: 'Rent escalators with a hard floor over CPI.',
  },
  {
    severity: 'medium',
    label: 'Medium',
    text: 'Compounding late fees that may be unenforceable penalties.',
  },
  {
    severity: 'low',
    label: 'Low',
    text: 'Outsized security deposits — worth a small-landlord exemption check.',
  },
];

export function UploadView({ onUpload, onTrySample }: UploadViewProps): JSX.Element {
  const { t } = useI18n();
  const [drag, setDrag] = useState(false);

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') void onUpload(file);
  }

  return (
    <section
      role="region"
      aria-label="upload"
      className="grid w-full max-w-[1080px] mx-auto gap-12 px-6 py-12 md:grid-cols-[1fr_280px]"
    >
      {/* Left: editorial headline + drop zone + footer chips */}
      <div>
        <p className="font-sans text-small uppercase tracking-wide text-fg-muted mb-3">
          {t('app.title')} · v1.0
        </p>
        <h2 className="font-display text-fg leading-[1.05] mb-5 text-[clamp(2.25rem,4vw,3.25rem)] font-semibold">
          Most leases are <span className="italic text-severity-high">fine.</span>
          <br />
          Three clauses
          <br />
          are <span className="border-b-2 border-severity-medium">not.</span>
        </h2>
        <p className="font-display text-fg-body leading-relaxed mb-7 max-w-[44ch] text-[16.5px]">
          LeaseGuard reads a lease PDF on this device, marks the clauses worth pushing back on, and
          explains them in plain language. Nothing leaves your browser.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`flex flex-wrap items-center gap-3 transition-[border-color,padding] duration-150 ${
            drag
              ? 'p-3 border border-dashed border-ink'
              : 'p-0 border border-dashed border-transparent'
          }`}
        >
          <label className="inline-flex items-center cursor-pointer">
            <span className="visually-hidden">{t('header.upload.label')}</span>
            <input
              type="file"
              accept="application/pdf"
              aria-label="upload lease"
              className="text-small"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await onUpload(file);
              }}
            />
          </label>
          <Button type="button" variant="default" size="sm" onClick={() => void onTrySample()}>
            {t('header.trySample')}
          </Button>
          <span className="font-display italic text-small text-fg-muted">
            …or drag a file anywhere on this row.
          </span>
        </div>

        <div className="mt-9 pt-4 border-t border-rule-subtle flex flex-wrap gap-7 font-sans text-small text-fg-muted">
          <span>● Local-first · no uploads</span>
          <span>● 10 rules · 4 jurisdictions</span>
          <span>● Ed25519-signed exports</span>
          <span>● Hash-chained audit log</span>
        </div>
      </div>

      {/* Right: "what you'll see" sample preview */}
      <div
        aria-label="what you will see"
        className="border-l border-rule pl-6 font-mono text-mono text-fg-faint leading-relaxed"
      >
        <div className="mb-3 uppercase tracking-wide">// what you&apos;ll see</div>
        {SAMPLE_PREVIEW.map((row, i) => (
          <div
            key={i}
            className="pl-2.5 mb-3"
            style={{ borderLeft: `2px solid var(--color-severity-${row.severity})` }}
          >
            <div
              className="uppercase tracking-wide font-semibold mb-0.5"
              style={{ color: `var(--color-severity-${row.severity})` }}
            >
              {row.label}
            </div>
            <div className="font-display italic text-fg-body text-[12.5px] leading-snug">
              {row.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
