import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { makePdf } from './parser/testFixtures';

async function makeLeaseFile(): Promise<File> {
  const bytes = await makePdf([
    {
      blocks: [
        { text: 'This lease shall auto-renew annually.', x: 72, y: 72 },
        { text: 'Tenant waives any right to a jury trial.', x: 72, y: 110 },
      ],
    },
  ]);
  return new File([bytes as BlobPart], 'lease.pdf', { type: 'application/pdf' });
}

describe('App', () => {
  it('renders the upload control in idle state', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /leaseguard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument();
  });

  it('shows findings after a successful upload and analysis', async () => {
    render(<App />);
    const file = await makeLeaseFile();
    const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/auto-renewal/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/waiver of jury trial/i)).toBeInTheDocument();
  });

  it('surfaces a parse error without crashing', async () => {
    render(<App />);
    const bogus = new File([new Uint8Array([1, 2, 3])], 'bad.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
    await userEvent.upload(input, bogus);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
