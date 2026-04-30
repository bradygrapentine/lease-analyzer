import { Component, Suspense, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  loadingFallback?: ReactNode;
  failureFallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wave 51-C — Suspense + error boundary wrapper for the lazy-loaded
 * `AppCurrentPane` chunk. Catches:
 *
 *   1. Chunk download failure (network blip, stale service-worker cache).
 *   2. Synchronous render errors inside the analyzed pane.
 *
 * The retry button calls `location.reload()` rather than re-mounting the
 * subtree because the most common cause is a stale chunk URL that won't
 * resolve until the SW updates.
 *
 * Strings are inlined English. Localizing them would require a hook
 * (only available in function components) and would make this file
 * export both a class and helpers — which the react-refresh lint rule
 * forbids. The fallback path is rare; the rest of the localized UI
 * remains unaffected.
 */
export class AnalyzedPaneBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(err: Error): void {
    console.error('AppCurrentPane render failed', err);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.failureFallback) return this.props.failureFallback;
      return (
        <div role="alert" className="px-4 py-6">
          <p className="mb-3 text-fg-body">
            The lease reader failed to load. This usually clears with a refresh.
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-sm border border-rule bg-paper-raised px-3 py-1 text-mono uppercase tracking-wider text-fg hover:bg-paper-sunken"
          >
            Reload
          </button>
        </div>
      );
    }
    return (
      <Suspense
        fallback={
          this.props.loadingFallback ?? (
            <div role="status" aria-live="polite" className="px-4 py-6 text-fg-body">
              Loading reader…
            </div>
          )
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
