import { useCallback, useState } from 'react';
import { Dialog } from './system/Dialog';
import { Button } from './system/Button';

export type OnboardingViewMode = 'current' | 'portfolio' | 'redline' | 'audit' | 'settings';

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
      className="!p-7"
    >
      <p className="text-mono uppercase tracking-[0.08em] text-fg-faint mb-2">
        Welcome to LeaseGuard
      </p>
      <h2
        id="onboarding-tour-title"
        className="font-serif text-[24px] font-semibold leading-snug text-fg m-0 mb-3"
      >
        {step.title}
      </h2>
      <p className="font-serif text-[15px] leading-[1.7] text-fg-body m-0 mb-3">{step.body}</p>
      {hint !== null && (
        <p
          role="note"
          className="font-serif italic text-fg-muted m-0 mb-4 border-l border-rule pl-3"
        >
          {hint}
        </p>
      )}
      <div className="mt-5 flex items-center justify-between border-t border-rule-subtle pt-4">
        <p
          aria-label={`step ${stepIndex + 1} of ${total}`}
          className="text-mono uppercase tracking-[0.08em] text-fg-faint m-0"
        >
          Step {stepIndex + 1} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            aria-label="skip onboarding tour"
          >
            Skip
          </Button>
          <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
          >
            Back
          </Button>
          {isLast ? (
            <Button
              type="button"
              size="sm"
              onClick={handleDismiss}
              aria-label="finish onboarding tour"
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
