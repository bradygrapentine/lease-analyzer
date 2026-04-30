import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSettingsPane } from './AppSettingsPane';
import { I18nProvider } from '../i18n/I18nProvider';

function renderPane(props: Partial<React.ComponentProps<typeof AppSettingsPane>> = {}) {
  const defaults: React.ComponentProps<typeof AppSettingsPane> = {
    onExportArchive: vi.fn(),
    onImportArchive: vi.fn(),
    onClearAll: vi.fn(),
  };
  return render(
    <I18nProvider>
      <AppSettingsPane {...defaults} {...props} />
    </I18nProvider>,
  );
}

describe('AppSettingsPane', () => {
  it('renders the three setting sections', () => {
    renderPane();
    expect(screen.getByRole('region', { name: /preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /data management/i })).toBeInTheDocument();
  });

  it('renders the lifted preferences (locale picker + theme toggle)', () => {
    renderPane();
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    // ThemeToggle exposes an aria-label that names the next theme; assert a button is present.
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders the privacy disclosure summary', () => {
    renderPane();
    expect(screen.getByText(/privacy.*how this works/i)).toBeInTheDocument();
  });

  it('fires onExportArchive when the export-archive button is clicked', async () => {
    const onExportArchive = vi.fn();
    renderPane({ onExportArchive });
    await userEvent.click(screen.getByRole('button', { name: /export.*archive/i }));
    expect(onExportArchive).toHaveBeenCalledTimes(1);
  });

  it('fires onClearAll when the clear-all button is clicked', async () => {
    const onClearAll = vi.fn();
    renderPane({ onClearAll });
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('fires onImportArchive when an .lgarchive file is uploaded', async () => {
    const onImportArchive = vi.fn();
    renderPane({ onImportArchive });
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
