import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OcrLanguagePickerPanel } from './OcrLanguagePickerPanel';

describe('OcrLanguagePickerPanel', () => {
  it('renders nothing when no languages are available', () => {
    const { container } = render(
      <OcrLanguagePickerPanel available={[]} selected="eng" onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a static label when only one language is available', () => {
    render(
      <OcrLanguagePickerPanel
        available={[{ code: 'eng', label: 'English' }]}
        selected="eng"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders a select when multiple languages are available', () => {
    render(
      <OcrLanguagePickerPanel
        available={[
          { code: 'eng', label: 'English' },
          { code: 'spa', label: 'Spanish' },
        ]}
        selected="eng"
        onChange={() => {}}
      />,
    );
    const select = screen.getByRole('combobox', { name: /ocr language/i });
    expect(select).toHaveValue('eng');
    expect(screen.getByRole('option', { name: 'Spanish' })).toBeInTheDocument();
  });

  it('emits onChange when the user picks another language', async () => {
    const onChange = vi.fn();
    render(
      <OcrLanguagePickerPanel
        available={[
          { code: 'eng', label: 'English' },
          { code: 'spa', label: 'Spanish' },
        ]}
        selected="eng"
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', { name: /ocr language/i });
    await userEvent.selectOptions(select, 'spa');
    expect(onChange).toHaveBeenCalledWith('spa');
  });
});
