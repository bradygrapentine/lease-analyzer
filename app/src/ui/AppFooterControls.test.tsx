import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppFooterControls } from './AppFooterControls';
import { I18nProvider } from '../i18n/I18nProvider';

function renderFooter(props: Partial<React.ComponentProps<typeof AppFooterControls>> = {}) {
  const defaults: React.ComponentProps<typeof AppFooterControls> = {
    onExportArchive: vi.fn(),
    onImportArchive: vi.fn(),
    onClearAll: vi.fn(),
  };
  return render(
    <I18nProvider>
      <AppFooterControls {...defaults} {...props} />
    </I18nProvider>,
  );
}

describe('AppFooterControls', () => {
  it('renders the three controls (export, import file input, clear)', () => {
    renderFooter();
    expect(screen.getByRole('button', { name: /import encrypted archive/i })).toBeInTheDocument();
    // Wave 45-F — three buttons: export archive + import-archive (FileButton)
    // + clear all. Pre-45-F there were two buttons + a label-wrapped input.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('fires onExportArchive when the export button is clicked', async () => {
    const onExportArchive = vi.fn();
    renderFooter({ onExportArchive });
    // Match the visible label (i18n string from footer.archive.export).
    await userEvent.click(screen.getByRole('button', { name: /export.*archive/i }));
    expect(onExportArchive).toHaveBeenCalledTimes(1);
  });

  it('fires onClearAll when the clear button is clicked', async () => {
    const onClearAll = vi.fn();
    renderFooter({ onClearAll });
    // i18n label from footer.clearAll.
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('fires onImportArchive with the selected file', async () => {
    const onImportArchive = vi.fn();
    renderFooter({ onImportArchive });
    // Wave 45-F — FileButton's hidden input is no longer reachable via
    // getByLabelText (the button carries the accessible name now). Query
    // the input directly.
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][accept*="lgarchive"]',
    );
    expect(input).not.toBeNull();
    const file = new File([new Uint8Array([0])], 'a.lgarchive', {
      type: 'application/octet-stream',
    });
    await userEvent.upload(input!, file);
    expect(onImportArchive).toHaveBeenCalledTimes(1);
  });
});
