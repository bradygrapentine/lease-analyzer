import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';
import { _resetAuditDbForTests } from '../audit/auditLog';

// Wave 29-C — verify the hybrid-feedback button is wired into FindingsPanel
// and that idempotency holds at the panel level too. We swap the audit IDB
// for an in-memory fake by stubbing the real listAuditEntries via the
// `_resetAuditDbForTests` plumbing — but the button's listEntries default is
// `listAuditEntries`, which uses fake-indexeddb under jsdom and starts empty
// per test, so we just exercise the real path.

beforeEach(() => {
  _resetAuditDbForTests();
  // Cleanup the fake IDB between tests so prior writes don't leak.
  indexedDB.deleteDatabase('leaseguard-audit');
});

const hybrid: Finding = {
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
};

const deterministic: Finding = {
  ...hybrid,
  ruleId: 'late-fee',
  title: 'Late fee',
  paragraphIndex: 5,
  evidence: undefined,
};

describe('FindingsPanel — hybrid-feedback wiring (Wave 29-C)', () => {
  it('renders the feedback button only for hybrid findings', () => {
    render(
      <FindingsPanel
        findings={[hybrid, deterministic]}
        onSelect={() => {}}
        leaseId="lease-1"
        onHybridFeedback={() => {}}
      />,
    );
    const buttons = screen.queryAllByRole('button', { name: /not relevant/i });
    expect(buttons).toHaveLength(1);
  });

  it('omits the button when no onHybridFeedback callback is provided', () => {
    render(
      <FindingsPanel
        findings={[hybrid]}
        onSelect={() => {}}
        leaseId="lease-1"
      />,
    );
    expect(screen.queryByRole('button', { name: /not relevant/i })).toBeNull();
  });

  it('calls onHybridFeedback once; second click is a no-op', async () => {
    const onHybridFeedback = vi.fn();
    render(
      <FindingsPanel
        findings={[hybrid]}
        onSelect={() => {}}
        leaseId="lease-1"
        onHybridFeedback={onHybridFeedback}
      />,
    );
    const btn = screen.getByRole('button', { name: /mark .* not relevant/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onHybridFeedback).toHaveBeenCalledTimes(1);
    expect(onHybridFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'auto-renew',
        paragraphIndex: 3,
        leaseId: 'lease-1',
        signal: 'not-relevant',
        modelId: 'classifier-x',
      }),
    );
  });
});
