import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideLetterPanel } from './SideLetterPanel';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'b',
    after: 'a',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

const noop = (): void => {};

describe('SideLetterPanel', () => {
  it('renders the lease name and unique edit count', () => {
    render(
      <SideLetterPanel
        leaseName="Acme Lease"
        edits={[mkEdit({ paragraphIndex: 1 }), mkEdit({ paragraphIndex: 2 })]}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    expect(screen.getByText('Acme Lease')).toBeInTheDocument();
    expect(screen.getByText(/2 proposed changes/i)).toBeInTheDocument();
  });

  it('pluralizes "proposed change" in the singular', () => {
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[mkEdit()]}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    expect(screen.getByText(/1 proposed change\b/i)).toBeInTheDocument();
  });

  it('counts duplicate paragraphIndex edits as one change', () => {
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[mkEdit({ paragraphIndex: 0 }), mkEdit({ paragraphIndex: 0 })]}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    expect(screen.getByText(/1 proposed change\b/i)).toBeInTheDocument();
  });

  it('prefills name + title from signerDraft', () => {
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        signerDraft={{ name: 'Jane', title: 'Counsel' }}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    expect((screen.getByLabelText(/signer name/i) as HTMLInputElement).value).toBe('Jane');
    expect((screen.getByLabelText(/signer title/i) as HTMLInputElement).value).toBe('Counsel');
  });

  it('typing in name field fires onSignerChange with the new name + unchanged title', async () => {
    const onSignerChange = vi.fn();
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        signerDraft={{ name: '', title: 'Counsel' }}
        onSignerChange={onSignerChange}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/signer name/i), 'J');
    expect(onSignerChange).toHaveBeenLastCalledWith({ name: 'J', title: 'Counsel' });
  });

  it('typing in title field fires onSignerChange with the new title + unchanged name', async () => {
    const onSignerChange = vi.fn();
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        signerDraft={{ name: 'Jane', title: '' }}
        onSignerChange={onSignerChange}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/signer title/i), 'C');
    expect(onSignerChange).toHaveBeenLastCalledWith({ name: 'Jane', title: 'C' });
  });

  it('Generate preview button fires onPreview', async () => {
    const onPreview = vi.fn();
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        onSignerChange={noop}
        onPreview={onPreview}
        onDownload={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /generate side letter preview/i }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('Download button fires onDownload', async () => {
    const onDownload = vi.fn();
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={onDownload}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /download side letter/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('treats missing signerDraft as empty strings in both inputs', () => {
    render(
      <SideLetterPanel
        leaseName="L"
        edits={[]}
        onSignerChange={noop}
        onPreview={noop}
        onDownload={noop}
      />,
    );
    expect((screen.getByLabelText(/signer name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/signer title/i) as HTMLInputElement).value).toBe('');
  });
});
