import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyzedPaneBoundary } from './AnalyzedPaneBoundary';
import { I18nProvider } from '../i18n/I18nProvider';

function Boom(): JSX.Element {
  throw new Error('synthetic render failure');
}

describe('AnalyzedPaneBoundary', () => {
  it('renders children on the happy path', () => {
    render(
      <I18nProvider>
        <AnalyzedPaneBoundary>
          <div>analyzed pane content</div>
        </AnalyzedPaneBoundary>
      </I18nProvider>,
    );
    expect(screen.getByText('analyzed pane content')).toBeInTheDocument();
  });

  it('falls back to a retry alert when a child throws', () => {
    // React logs the error to stderr; suppress to keep test output clean.
    const originalError = console.error;
    console.error = (): void => {};
    try {
      render(
        <I18nProvider>
          <AnalyzedPaneBoundary>
            <Boom />
          </AnalyzedPaneBoundary>
        </I18nProvider>,
      );
    } finally {
      console.error = originalError;
    }
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
