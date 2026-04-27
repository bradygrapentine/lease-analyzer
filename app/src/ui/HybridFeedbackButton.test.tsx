import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HybridFeedbackButton } from './HybridFeedbackButton';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'auto-renew',
    severity: 'medium',
    category: 'general',
    title: 'Auto-renewal clause',
    explanation: 'explanation',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.8,
    negated: false,
    rulePackVersion: '1.0.0',
    evidence: { modelId: 'classifier-x', similarity: 0.82 },
    ...over,
  };
}

describe('HybridFeedbackButton', () => {
  it('renders nothing when finding has no hybrid evidence', () => {
    const { container } = render(
      <HybridFeedbackButton
        finding={f({ evidence: undefined })}
        leaseId="lease-1"
        onSubmit={() => {}}
        listEntries={() => Promise.resolve([])}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('writes audit payload once on click', async () => {
    const onSubmit = vi.fn();
    render(
      <HybridFeedbackButton
        finding={f()}
        leaseId="lease-1"
        onSubmit={onSubmit}
        listEntries={() => Promise.resolve([])}
      />,
    );
    const btn = screen.getByRole('button', { name: /mark .* not relevant/i });
    await userEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      ruleId: 'auto-renew',
      paragraphIndex: 3,
      modelId: 'classifier-x',
      similarity: 0.82,
      leaseId: 'lease-1',
      signal: 'not-relevant',
    });
  });

  it('second click is a no-op (idempotent)', async () => {
    const onSubmit = vi.fn();
    render(
      <HybridFeedbackButton
        finding={f()}
        leaseId="lease-1"
        onSubmit={onSubmit}
        listEntries={() => Promise.resolve([])}
      />,
    );
    const btn = screen.getByRole('button', { name: /mark .* not relevant/i });
    await userEvent.click(btn);
    // After click button is disabled+pressed; clicking again must not fire.
    await userEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toBeDisabled();
  });

  it('skips write when audit chain already has a matching entry', async () => {
    const onSubmit = vi.fn();
    const existing = [
      {
        kind: 'hybrid-feedback',
        payload: {
          ruleId: 'auto-renew',
          paragraphIndex: 3,
          leaseId: 'lease-1',
          signal: 'not-relevant',
          modelId: 'classifier-x',
          similarity: 0.82,
        },
      },
    ];
    render(
      <HybridFeedbackButton
        finding={f()}
        leaseId="lease-1"
        onSubmit={onSubmit}
        listEntries={() => Promise.resolve(existing)}
      />,
    );
    const btn = screen.getByRole('button', { name: /not relevant/i });
    // The mount-effect should disable the button after detecting the prior entry.
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
    await userEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not write twice if the chain gains a matching entry between clicks', async () => {
    // Simulate concurrency: list returns empty on mount but a matching entry
    // by the time the click fires (e.g. another tab or test step appended).
    const onSubmit = vi.fn();
    let callCount = 0;
    const listEntries = (): Promise<
      Array<{ kind: string; payload: Record<string, unknown> }>
    > => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve([]);
      return Promise.resolve([
        {
          kind: 'hybrid-feedback',
          payload: {
            ruleId: 'auto-renew',
            paragraphIndex: 3,
            leaseId: 'lease-1',
            signal: 'not-relevant',
            modelId: 'classifier-x',
            similarity: 0.82,
          },
        },
      ]);
    };
    render(
      <HybridFeedbackButton
        finding={f()}
        leaseId="lease-1"
        onSubmit={onSubmit}
        listEntries={listEntries}
      />,
    );
    const btn = screen.getByRole('button', { name: /not relevant/i });
    await userEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
  });
});
