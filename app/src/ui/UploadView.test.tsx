import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadView } from './UploadView';
import { I18nProvider } from '../i18n/I18nProvider';

function renderView(props: Partial<React.ComponentProps<typeof UploadView>> = {}) {
  const defaults: React.ComponentProps<typeof UploadView> = {
    onUpload: vi.fn(),
    onTrySample: vi.fn(),
  };
  return render(
    <I18nProvider>
      <UploadView {...defaults} {...props} />
    </I18nProvider>,
  );
}

describe('UploadView', () => {
  it('renders the annotated headline and the upload affordances', () => {
    renderView();
    expect(screen.getByRole('region', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent(/most leases are/i);
    expect(screen.getByRole('heading')).toHaveTextContent(/three clauses/i);
    expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try a sample lease/i })).toBeInTheDocument();
  });

  it('renders the "what you\'ll see" sample preview column', () => {
    renderView();
    const preview = screen.getByLabelText(/what you will see/i);
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveTextContent(/renewal clauses/i);
    expect(preview).toHaveTextContent(/late fees/i);
  });

  it('fires onUpload when a PDF is selected via the file input', async () => {
    const onUpload = vi.fn();
    renderView({ onUpload });
    const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 't.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it('fires onTrySample when the sample-lease button is clicked', async () => {
    const onTrySample = vi.fn();
    renderView({ onTrySample });
    await userEvent.click(screen.getByRole('button', { name: /try a sample lease/i }));
    expect(onTrySample).toHaveBeenCalledTimes(1);
  });
});
