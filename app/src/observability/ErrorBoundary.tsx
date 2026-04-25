import { Component, type ErrorInfo, type ReactNode } from 'react';
import { diagnosticsReport, diagnosticsSummary, recordCrash } from './crashLog';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  err: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { err: null };

  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return { err };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    recordCrash(err, info.componentStack ?? undefined);
  }

  private handleDownload = (): void => {
    const json = diagnosticsReport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leaseguard-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  private handleReload = (): void => {
    this.setState({ err: null });
  };

  override render(): ReactNode {
    if (!this.state.err) return this.props.children;
    return (
      <div role="alert" className="error-boundary">
        <h1>Something went wrong</h1>
        <p>{this.state.err.message}</p>
        <p>
          Your data is still on this device. You can download a local diagnostics report
          (no data leaves your device unless you share the file).
        </p>
        <details className="diagnostics-summary" open>
          <summary>What's in the diagnostics file</summary>
          <ul>
            {diagnosticsSummary().map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
        <button type="button" onClick={this.handleDownload}>
          Download diagnostics
        </button>
        <button type="button" onClick={this.handleReload}>
          Try again
        </button>
      </div>
    );
  }
}
