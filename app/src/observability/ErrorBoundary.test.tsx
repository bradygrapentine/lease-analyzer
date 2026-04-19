import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';
import { clearCrashLog, snapshotCrashLog } from './crashLog';

function Boom(): JSX.Element {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    clearCrashLog();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <p>hello</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders a fallback and records the crash', () => {
    // React logs the error to console.error; silence it for test cleanliness.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(snapshotCrashLog()[0]?.message).toBe('boom');
    spy.mockRestore();
  });

  it('the fallback has a "Download diagnostics" button that triggers a download', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const origCreate = document.createElement.bind(document);
    const clicks: string[] = [];
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = (): void => void clicks.push(el.getAttribute('download') ?? '');
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /download diagnostics/i }));
    expect(clicks[0]).toMatch(/leaseguard-diagnostics-.*\.json/);

    createSpy.mockRestore();
    spy.mockRestore();
  });
});
