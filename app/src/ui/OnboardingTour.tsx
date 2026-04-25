import { useCallback, useEffect, useState } from 'react';

interface OnboardingTourProps {
  /** Existing dismissal timestamp; if non-null, the tour renders nothing. */
  dismissedAt: number | null;
  /** Called when the user dismisses the tour (Got it / Skip / Esc). */
  onDismiss: () => void;
}

interface Step {
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    title: 'Local-first by design',
    body:
      'LeaseGuard runs entirely in your browser. PDFs are parsed on your device, ' +
      'findings live in IndexedDB, and nothing leaves your machine.',
  },
  {
    title: 'Upload a lease — or try a sample',
    body:
      'Drop a PDF onto the upload control to get started. No PDF handy? Click ' +
      '"Try a sample lease" to walk through a fully synthetic example.',
  },
  {
    title: 'Click through findings',
    body:
      'Each finding links back to the page and clause that triggered it. ' +
      'Use the sidebar to filter by category or severity.',
  },
  {
    title: 'OCR is opt-in',
    body:
      'If a lease is a scanned image, LeaseGuard can run OCR locally — but ' +
      'only after you opt in. The OCR engine ships with the app; no upload happens.',
  },
];

export function OnboardingTour({ dismissedAt, onDismiss }: OnboardingTourProps): JSX.Element | null {
  const [stepIndex, setStepIndex] = useState(0);
  const total = STEPS.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;

  const handleDismiss = useCallback((): void => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (dismissedAt !== null) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissedAt, handleDismiss]);

  if (dismissedAt !== null) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      className="onboarding-tour"
      tabIndex={-1}
    >
      <div className="onboarding-tour__panel">
        <h2 id="onboarding-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <p
          className="onboarding-tour__progress"
          aria-label={`step ${stepIndex + 1} of ${total}`}
        >
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
              Got it
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
      </div>
    </div>
  );
}
