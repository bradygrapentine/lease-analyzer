import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReaderPdfToggle } from './ReaderPdfToggle';
import { I18nProvider } from '../i18n/I18nProvider';

function renderToggle(mode: 'reader' | 'pdf', onChange = vi.fn()): ReturnType<typeof vi.fn> {
  render(
    <I18nProvider>
      <ReaderPdfToggle mode={mode} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

describe('ReaderPdfToggle', () => {
  it('marks the active tab via aria-selected', () => {
    renderToggle('reader');
    expect(screen.getByRole('tab', { name: /reader/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^pdf$/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange("pdf") when the PDF tab is clicked', async () => {
    const onChange = renderToggle('reader');
    await userEvent.click(screen.getByRole('tab', { name: /^pdf$/i }));
    expect(onChange).toHaveBeenCalledWith('pdf');
  });

  it('calls onChange("reader") when the Reader tab is clicked', async () => {
    const onChange = renderToggle('pdf');
    await userEvent.click(screen.getByRole('tab', { name: /reader/i }));
    expect(onChange).toHaveBeenCalledWith('reader');
  });
});
