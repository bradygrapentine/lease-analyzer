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
    expect(screen.getByLabelText(/bulk import files/i)).toBeInTheDocument();
  });

  it('streams per-file status and renders a summary when done', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(
      async (_files: File[], onProgress: (r: BulkResult) => void): Promise<BulkSummary> => {
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

  it('renders one row per top-level PDF entry inside a zip input', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(
      async (_files: File[], onProgress: (r: BulkResult) => void): Promise<BulkSummary> => {
        onProgress({ fileName: 'batch.zip/a.pdf', hash: 'h1', status: 'ok', leaseId: 'id-a' });
        onProgress({ fileName: 'batch.zip/b.pdf', hash: 'h2', status: 'skipped' });
        onProgress({
          fileName: 'batch.zip/broken.pdf',
          hash: '',
          status: 'error',
          error: 'corrupted PDF',
        });
        return { ok: 1, skipped: 1, errors: 1 };
      },
    );

    render(<BulkImportPanel onImport={onImport} />);
    const input = screen.getByLabelText(/bulk import files/i) as HTMLInputElement;
    const zipFile = new File([new Uint8Array([0])], 'batch.zip', { type: 'application/zip' });
    await user.upload(input, [zipFile]);

    await waitFor(() =>
      expect(screen.getByLabelText(/bulk import summary/i)).toHaveTextContent(
        /Imported 1 · skipped 1 · errors 1/,
      ),
    );
    expect(screen.getByText('batch.zip/a.pdf')).toBeInTheDocument();
    expect(screen.getByText('batch.zip/b.pdf')).toBeInTheDocument();
    expect(screen.getByText('batch.zip/broken.pdf')).toBeInTheDocument();
    expect(screen.getByText(/corrupted PDF/)).toBeInTheDocument();
  });

  it('surfaces errors per file', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(
      async (_files: File[], onProgress: (r: BulkResult) => void): Promise<BulkSummary> => {
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
