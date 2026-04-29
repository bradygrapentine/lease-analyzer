import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsHeader } from './ResultsHeader';
import { I18nProvider } from '../../i18n/I18nProvider';

function setup(over: Partial<React.ComponentProps<typeof ResultsHeader>> = {}) {
  const props: React.ComponentProps<typeof ResultsHeader> = {
    hasSigningKey: false,
    onExportJson: vi.fn(),
    onExportSignedJson: vi.fn(),
    onExportHtml: vi.fn(),
    ...over,
  };
  return {
    props,
    ...render(
      <I18nProvider>
        <ResultsHeader {...props} />
      </I18nProvider>,
    ),
  };
}

describe('ResultsHeader', () => {
  it('renders JSON + HTML export buttons (signed hidden when no key)', () => {
    setup();
    expect(screen.getAllByRole('button').length).toBe(2);
    expect(screen.queryByRole('button', { name: /signed/i })).toBeNull();
  });

  it('renders the signed-export button only when hasSigningKey is true', () => {
    setup({ hasSigningKey: true });
    expect(screen.getByRole('button', { name: /signed/i })).toBeInTheDocument();
  });

  it('renders the signed-export disclosure only when hasSigningKey is true', () => {
    const { rerender } = setup({ hasSigningKey: false });
    expect(screen.queryByText(/what is signed export/i)).toBeNull();
    rerender(
      <I18nProvider>
        <ResultsHeader
          hasSigningKey={true}
          onExportJson={vi.fn()}
          onExportSignedJson={vi.fn()}
          onExportHtml={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/what is signed export/i)).toBeInTheDocument();
    // Wave 45-D copy verbatim — claim must map to code (Ed25519 sign over
    // payload, recipient must compare embedded pubkey out-of-band).
    expect(
      screen.getByText(/share your public key with the recipient out-of-band/i),
    ).toBeInTheDocument();
  });

  it('fires onExportJson when the JSON-export button is clicked', async () => {
    const onExportJson = vi.fn();
    setup({ onExportJson });
    await userEvent.click(screen.getByRole('button', { name: /json/i }));
    expect(onExportJson).toHaveBeenCalledTimes(1);
  });

  it('fires onExportHtml when the HTML-export button is clicked', async () => {
    const onExportHtml = vi.fn();
    setup({ onExportHtml });
    await userEvent.click(screen.getByRole('button', { name: /html/i }));
    expect(onExportHtml).toHaveBeenCalledTimes(1);
  });

  it('fires onExportSignedJson when the signed-export button is clicked', async () => {
    const onExportSignedJson = vi.fn();
    setup({ hasSigningKey: true, onExportSignedJson });
    await userEvent.click(screen.getByRole('button', { name: /signed/i }));
    expect(onExportSignedJson).toHaveBeenCalledTimes(1);
  });
});
