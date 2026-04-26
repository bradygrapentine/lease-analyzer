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
    expect(screen.getByLabelText(/import encrypted archive/i)).toBeInTheDocument();
    // Two buttons: export archive + clear all. Their labels come from i18n.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('fires onExportArchive when the export button is clicked', async () => {
    const onExportArchive = vi.fn();
    renderFooter({ onExportArchive });
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]!);
    expect(onExportArchive).toHaveBeenCalledTimes(1);
  });

  it('fires onClearAll when the clear button is clicked', async () => {
    const onClearAll = vi.fn();
    renderFooter({ onClearAll });
    const buttons = screen.getAllByRole('button');
    // Second button is clear-all per render order.
    await userEvent.click(buttons[1]!);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('fires onImportArchive with the selected file', async () => {
    const onImportArchive = vi.fn();
    renderFooter({ onImportArchive });
    const input = screen.getByLabelText(/import encrypted archive/i) as HTMLInputElement;
    const file = new File([new Uint8Array([0])], 'a.lgarchive', {
      type: 'application/octet-stream',
    });
    await userEvent.upload(input, file);
    expect(onImportArchive).toHaveBeenCalledTimes(1);
  });
});
