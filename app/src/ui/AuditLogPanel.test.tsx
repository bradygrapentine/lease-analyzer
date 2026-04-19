import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuditEntry } from '../audit/auditLog';
import { AuditLogPanel } from './AuditLogPanel';

function entry(seq: number, over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    seq,
    timestamp: `2026-04-18T0${seq}:00:00.000Z`,
    kind: 'analyze',
    payload: { leaseName: `lease-${seq}.pdf` },
    prevHash: seq === 1 ? '' : 'a'.repeat(64),
    entryHash: 'b'.repeat(64),
    ...over,
  };
}

describe('AuditLogPanel', () => {
  it('renders the empty state when no entries', () => {
    render(
      <AuditLogPanel
        entries={[]}
        verification={null}
        onRefresh={() => {}}
        onDownload={() => {}}
        onVerify={() => {}}
      />,
    );
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a row per entry', () => {
    render(
      <AuditLogPanel
        entries={[entry(1), entry(2, { kind: 'export' })]}
        verification={null}
        onRefresh={() => {}}
        onDownload={() => {}}
        onVerify={() => {}}
      />,
    );
    const rows = screen.getAllByRole('row');
    // header + 2 entries
    expect(rows).toHaveLength(3);
    expect(screen.getByText('analyze')).toBeInTheDocument();
    expect(screen.getByText('export')).toBeInTheDocument();
  });

  it('shows chain-intact status when verification.ok=true', () => {
    render(
      <AuditLogPanel
        entries={[entry(1), entry(2)]}
        verification={{ ok: true }}
        onRefresh={() => {}}
        onDownload={() => {}}
        onVerify={() => {}}
      />,
    );
    expect(screen.getByTestId('audit-verification')).toHaveTextContent(
      /chain intact/i,
    );
  });

  it('shows break status with firstBadSeq when ok=false', () => {
    render(
      <AuditLogPanel
        entries={[entry(1), entry(2)]}
        verification={{ ok: false, firstBadSeq: 2 }}
        onRefresh={() => {}}
        onDownload={() => {}}
        onVerify={() => {}}
      />,
    );
    expect(screen.getByTestId('audit-verification')).toHaveTextContent(
      /chain broken at seq 2/i,
    );
  });

  it('wires Refresh / Verify / Download buttons to their props', async () => {
    const onRefresh = vi.fn();
    const onVerify = vi.fn();
    const onDownload = vi.fn();
    const user = userEvent.setup();
    render(
      <AuditLogPanel
        entries={[entry(1)]}
        verification={null}
        onRefresh={onRefresh}
        onVerify={onVerify}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await user.click(screen.getByRole('button', { name: /verify chain/i }));
    await user.click(
      screen.getByRole('button', { name: /download audit log/i }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('truncates long payloads in the table', () => {
    const big = { a: 'x'.repeat(200) };
    render(
      <AuditLogPanel
        entries={[entry(1, { payload: big })]}
        verification={null}
        onRefresh={() => {}}
        onDownload={() => {}}
        onVerify={() => {}}
      />,
    );
    // Truncated form ends with ...
    const code = screen.getByText(/^\{"a":"xxx/);
    expect(code.textContent?.endsWith('...')).toBe(true);
  });
});
