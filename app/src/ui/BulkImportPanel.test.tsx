import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkImportPanel } from './BulkImportPanel';
import type { BulkResult, BulkSummary } from '../workflow/bulkImport';

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, {
    type: 'application/pdf',
  });
}

describe('BulkImportPanel', () => {
  it('renders a file input with the expected accessible label', () => {
    render(<BulkImportPanel onImport={vi.fn()} />);
    expect(
      screen.getByLabelText(/bulk import files/i),
    ).toBeInTheDocument();
  });

  it('streams per-file status and renders a summary when done', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(
      async (
        _files: File[],
        onProgress: (r: BulkResult) => void,
      ): Promise<BulkSummary> => {
        onProgress({ fileName: 'a.pdf', hash: 'h1', status: 'ok', leaseId: 'id-a' });
        onProgress({ fileName: 'b.pdf', hash: 'h2', status: 'skipped' });
        return { ok: 1, skipped: 1, errors: 0 };
      },
    );

    render(<BulkImportPanel onImport={onImport} />);
    const input = screen.getByLabelText(/bulk import files/i) as HTMLInputElement;
    await user.upload(input, [makeFile('a.pdf'), makeFile('b.pdf')]);

    await waitFor(() =>
      expect(screen.getByLabelText(/bulk import summary/i)).toHaveTextContent(
        /Imported 1 · skipped 1 · errors 0/,
      ),
    );
    expect(onImport).toHaveBeenCalledTimes(1);
    const status0 = await screen.findByTestId('bulk-status-0');
    expect(status0.textContent).toMatch(/Imported/);
    const status1 = await screen.findByTestId('bulk-status-1');
    expect(status1.textContent).toMatch(/Skipped/);
  });

  it('surfaces errors per file', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(
      async (
        _files: File[],
        onProgress: (r: BulkResult) => void,
      ): Promise<BulkSummary> => {
        onProgress({
          fileName: 'oops.pdf',
          hash: '',
          status: 'error',
          error: 'boom',
        });
        return { ok: 0, skipped: 0, errors: 1 };
      },
    );
    render(<BulkImportPanel onImport={onImport} />);
    const input = screen.getByLabelText(/bulk import files/i) as HTMLInputElement;
    await user.upload(input, [makeFile('oops.pdf')]);
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  });
});
