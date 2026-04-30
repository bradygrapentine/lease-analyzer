import { Component, Suspense, type ReactNode } from 'react';
import { I18nContext } from '../i18n/I18nContext';

interface Props {
  children: ReactNode;
  /** Override the loading + failure UI for tests / Storybook. */
  loadingFallback?: ReactNode;
  failureFallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wave 51-C — Suspense + error boundary wrapper for the lazy-loaded
 * `AppCurrentPane` chunk. Two failure modes this catches:
 *
 *   1. Chunk download fails (network blip, stale service-worker cache,
 *      bad deploy). Without recovery the user sees a blank current view
 *      with no way to retry except a hard refresh.
 *   2. Synchronous render error inside the analyzed pane.
 *
 * The retry button calls `location.reload()` rather than re-mounting the
 * subtree, because the most common cause is a stale chunk URL that won't
 * resolve until the SW updates.
 *
 * Renders raw i18n strings (read via the static `I18nContext` consumer)
 * so this file's only export remains a single component class — fast
 * refresh requires that.
 */
export class AnalyzedPaneBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static override contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(err: Error): void {
    console.error('AppCurrentPane render failed', err);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.failureFallback) return this.props.failureFallback;
      const t = this.context?.t;
      return (
        <div role="alert" className="px-4 py-6">
          <p className="mb-3 text-fg-body">
            {t ? t('reader.failure.message') : 'The lease reader failed to load.'}
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-sm border border-rule bg-paper-raised px-3 py-1 text-mono uppercase tracking-wider text-fg hover:bg-paper-sunken"
          >
            {t ? t('reader.failure.retry') : 'Reload'}
          </button>
        </div>
      );
    }
    const fallback =
      this.props.loadingFallback ??
      (() => {
        const t = this.context?.t;
        return (
          <div role="status" aria-live="polite" className="px-4 py-6 text-fg-muted">
            {t ? t('reader.loading') : 'Loading reader…'}
          </div>
        );
      })();
    return <Suspense fallback={fallback}>{this.props.children}</Suspense>;
  }
}
