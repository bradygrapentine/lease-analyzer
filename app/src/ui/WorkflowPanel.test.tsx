import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowPanel } from './WorkflowPanel';
import type { Finding } from '../rules/types';

const findings: Finding[] = [];

function baseProps(
  over: Partial<React.ComponentProps<typeof WorkflowPanel>> = {},
): React.ComponentProps<typeof WorkflowPanel> {
  return {
    leaseName: 'Unit 4B',
    findings,
    onBuildIcs: vi.fn(),
    onCopySummary: vi.fn().mockResolvedValue(undefined),
    onDownloadHandoff: vi.fn(),
    ...over,
  };
}

describe('WorkflowPanel', () => {
  it('renders the lease name and three action buttons', () => {
    render(<WorkflowPanel {...baseProps()} />);
    expect(screen.getByText(/Unit 4B/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download \.ics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download handoff zip/i })).toBeInTheDocument();
  });

  it('invokes onBuildIcs when the ICS button is clicked', async () => {
    const onBuildIcs = vi.fn();
    render(<WorkflowPanel {...baseProps({ onBuildIcs })} />);
    await userEvent.click(screen.getByRole('button', { name: /download \.ics/i }));
    expect(onBuildIcs).toHaveBeenCalledTimes(1);
  });

  it('invokes onDownloadHandoff when the handoff button is clicked', async () => {
    const onDownloadHandoff = vi.fn();
    render(<WorkflowPanel {...baseProps({ onDownloadHandoff })} />);
    await userEvent.click(screen.getByRole('button', { name: /download handoff zip/i }));
    expect(onDownloadHandoff).toHaveBeenCalledTimes(1);
  });

  it('shows "Copied!" after a successful copy', async () => {
    const onCopySummary = vi.fn().mockResolvedValue(undefined);
    render(<WorkflowPanel {...baseProps({ onCopySummary })} />);
    await userEvent.click(screen.getByRole('button', { name: /copy summary/i }));
    expect(onCopySummary).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it('shows a failure message when copy rejects', async () => {
    const onCopySummary = vi.fn().mockRejectedValue(new Error('nope'));
    render(<WorkflowPanel {...baseProps({ onCopySummary })} />);
    await userEvent.click(screen.getByRole('button', { name: /copy summary/i }));
    expect(await screen.findByText(/copy failed/i)).toBeInTheDocument();
  });

  it('disables actions while the copy is in flight', async () => {
    const resolveRef: { current: (() => void) | null } = { current: null };
    const onCopySummary = vi.fn().mockReturnValue(
      new Promise<void>((r) => {
        resolveRef.current = r;
      }),
    );
    render(<WorkflowPanel {...baseProps({ onCopySummary })} />);
    const btn = screen.getByRole('button', { name: /copy summary/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    resolveRef.current?.();
    // After the promise resolves the button re-enables.
    await screen.findByText(/copied/i);
    expect(btn).not.toBeDisabled();
  });
});
