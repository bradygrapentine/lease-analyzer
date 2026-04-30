import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingView } from './LoadingView';

describe('LoadingView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the file name and an aria-live status region', () => {
    render(<LoadingView fileName="cortland.pdf" intervalMs={0} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/cortland\.pdf/)).toBeInTheDocument();
  });

  it('renders five loader stages', () => {
    render(<LoadingView fileName="x.pdf" intervalMs={0} />);
    expect(screen.getAllByTestId('loading-stage')).toHaveLength(5);
  });

  it('starts with the first stage active and the rest pending', () => {
    render(<LoadingView fileName="x.pdf" intervalMs={0} />);
    const stages = screen.getAllByTestId('loading-stage');
    expect(stages[0]).toHaveAttribute('data-stage', 'active');
    expect(stages[1]).toHaveAttribute('data-stage', 'pending');
  });

  it('advances stages on the timer', () => {
    render(<LoadingView fileName="x.pdf" intervalMs={100} />);
    expect(screen.getAllByTestId('loading-stage')[0]).toHaveAttribute('data-stage', 'active');
    act(() => {
      vi.advanceTimersByTime(110);
    });
    const stages = screen.getAllByTestId('loading-stage');
    expect(stages[0]).toHaveAttribute('data-stage', 'done');
    expect(stages[1]).toHaveAttribute('data-stage', 'active');
  });
});
