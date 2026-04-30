import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppAuditPane } from './AppAuditPane';
import type { AuditEntry } from '../audit/auditLog';

function entry(seq: number, kind = 'analyze'): AuditEntry {
  return {
    seq,
    timestamp: `2026-04-30T0${seq}:00:00.000Z`,
    kind,
    payload: { fileName: `lease-${seq}.pdf` },
    prevHash: seq === 1 ? '' : 'a'.repeat(64),
    entryHash: 'b'.repeat(64),
  };
}

describe('AppAuditPane', () => {
  it('renders the audit log table after lazy load', async () => {
    render(
      <AppAuditPane
        entries={[entry(1), entry(2, 'export')]}
        verification={null}
        onRefresh={vi.fn()}
        onVerify={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    // AuditLogPanel is lazy; resolves async.
    expect(await screen.findByRole('table', { name: /audit entries/i })).toBeInTheDocument();
    expect(screen.getByText('analyze')).toBeInTheDocument();
    expect(screen.getByText('export')).toBeInTheDocument();
  });

  it('renders the empty state when no entries', async () => {
    render(
      <AppAuditPane
        entries={[]}
        verification={null}
        onRefresh={vi.fn()}
        onVerify={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it('passes the current entries + verification through to onDownload', async () => {
    const onDownload = vi.fn();
    const entries = [entry(1)];
    const verification = { ok: true } as const;
    render(
      <AppAuditPane
        entries={entries}
        verification={verification}
        onRefresh={vi.fn()}
        onVerify={vi.fn()}
        onDownload={onDownload}
      />,
    );
    const downloadBtn = await screen.findByRole('button', { name: /^download$/i });
    downloadBtn.click();
    expect(onDownload).toHaveBeenCalledWith(entries, verification);
  });
});
