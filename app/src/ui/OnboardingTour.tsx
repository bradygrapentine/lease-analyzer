import { useCallback, useState } from 'react';
import { Dialog } from './system/Dialog';

export type OnboardingViewMode = 'current' | 'portfolio' | 'redline';

interface OnboardingTourProps {
  /** Existing dismissal timestamp; if non-null, the tour renders nothing. */
  dismissedAt: number | null;
  /** Called when the user dismisses the tour (Got it / Skip / Esc). */
  onDismiss: () => void;
  /** Current top-level view; lets later steps tell the user where to look. */
  viewMode?: OnboardingViewMode;
}

interface Step {
  title: string;
  body: string;
  /** Optional contextual hint that varies with the active view. */
  hint?: (view: OnboardingViewMode | undefined) => string | null;
}

const STEPS: readonly Step[] = [
  {
    title: 'Upload a lease — or try a sample',
    body:
      'Drop a PDF onto the upload control to get started. No PDF handy? Click ' +
      '"Try a sample lease" to walk through a fully synthetic example. ' +
      'Everything runs locally in your browser — nothing leaves your machine.',
  },
  {
    title: 'Findings: severity + click-to-highlight',
    body:
      'Each finding is tagged Critical / Warning / Info and links back to ' +
      'the page and clause that triggered it. Click a finding to jump to the ' +
      'matching span in the PDF viewer; filter the list by category or severity.',
  },
  {
    title: 'Portfolio: rollups across every saved lease',
    body:
      'The Portfolio view aggregates rule hits across your saved leases, ' +
      'flags clauses that drift from your standard suite, and shows ' +
      'severity overrides scoped to your portfolio.',
    hint: (view) => {
      if (view === undefined) return null;
      return view === 'portfolio'
        ? "You're already on the Portfolio view."
        : 'Click the "Portfolio" button at the top of the page to open it.';
    },
  },
  {
    title: 'Audit log + export',
    body:
      'Most in-app actions append to a local, hash-chained audit log you can ' +
      'verify and download. The export toolbar above the findings list lets you ' +
      'save findings as JSON or HTML, and (if you have a signing key) as a ' +
      'signed JSON file you can hand to a counterparty. See the Audit Log ' +
      'panel at the bottom for the running record.',
  },
];

export function OnboardingTour({
  dismissedAt,
  onDismiss,
  viewMode,
}: OnboardingTourProps): JSX.Element | null {
  const [stepIndex, setStepIndex] = useState(0);
  const total = STEPS.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;

  const handleDismiss = useCallback((): void => {
    onDismiss();
  }, [onDismiss]);

  if (dismissedAt !== null) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;
  const hint = step.hint?.(viewMode) ?? null;

  // Wave 45-F — Dialog primitive owns the focus trap, initial focus, return
  // focus, and Esc handler. Tour content stays in this component.
  return (
    <Dialog
      open={dismissedAt === null}
      onDismiss={handleDismiss}
      titleId="onboarding-tour-title"
      className="onboarding-tour__panel"
    >
      <h2 id="onboarding-tour-title">{step.title}</h2>
      <p>{step.body}</p>
      {hint !== null && (
        <p className="onboarding-tour__hint" role="note">
          {hint}
        </p>
      )}
      <p className="onboarding-tour__progress" aria-label={`step ${stepIndex + 1} of ${total}`}>
        Step {stepIndex + 1} of {total}
      </p>
      <div className="onboarding-tour__actions">
        <button
          type="button"
          tabIndex={0}
          onClick={handleDismiss}
          aria-label="skip onboarding tour"
        >
          Skip
        </button>
        <button
          type="button"
          tabIndex={0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
        >
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            tabIndex={0}
            onClick={handleDismiss}
            aria-label="finish onboarding tour"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            tabIndex={0}
            onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
          >
            Next
          </button>
        )}
      </div>
    </Dialog>
  );
}
