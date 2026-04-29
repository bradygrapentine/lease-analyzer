import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { FileButton } from './FileButton';

describe('FileButton', () => {
  it('renders the visible label', () => {
    render(<FileButton onFiles={() => {}}>Import lease</FileButton>);
    expect(screen.getByText('Import lease')).toBeInTheDocument();
  });

  it('exposes a hidden file input with the configured accept and multiple', () => {
    const { container } = render(
      <FileButton accept=".pdf" multiple onFiles={() => {}}>
        Pick
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', '.pdf');
    expect(input).toHaveAttribute('multiple');
    // Visually hidden but still in the accessibility tree (not aria-hidden).
    expect(input.className).toContain('sr-only');
  });

  it('calls onFiles when a file is picked', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(
      <FileButton onFiles={onFiles} aria-label="Import lease">
        Import
      </FileButton>,
    );
    const input = screen.getByLabelText('Import lease') as HTMLInputElement;
    const file = new File(['content'], 'lease.pdf', { type: 'application/pdf' });
    await user.upload(input, file);
    expect(onFiles).toHaveBeenCalledTimes(1);
    const fileList = onFiles.mock.calls[0]?.[0] as FileList;
    expect(fileList.length).toBe(1);
    expect(fileList[0]?.name).toBe('lease.pdf');
  });

  it('size md hits the 44px AAA tap-target floor; sm hits 32px', () => {
    const { rerender, container } = render(
      <FileButton size="md" onFiles={() => {}}>
        Md
      </FileButton>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('h-11');
    rerender(
      <FileButton size="sm" onFiles={() => {}}>
        Sm
      </FileButton>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('h-8');
  });

  it('disabled state disables the input + visually-disables the label', () => {
    const onFiles = vi.fn();
    const { container } = render(
      <FileButton disabled onFiles={onFiles} aria-label="Import">
        Import
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(container.firstChild as HTMLElement).toHaveAttribute('aria-disabled', 'true');
  });

  it('forwards aria-describedby to the input', () => {
    const { container } = render(
      <FileButton aria-describedby="hint" aria-label="Pick" onFiles={() => {}}>
        Pick
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-describedby', 'hint');
  });

  it('has no a11y violations across variants and sizes', async () => {
    const { container } = render(
      <div>
        <FileButton onFiles={() => {}} aria-label="default-md">
          Default md
        </FileButton>
        <FileButton variant="ghost" size="sm" onFiles={() => {}} aria-label="ghost-sm">
          Ghost sm
        </FileButton>
        <FileButton variant="subtle" size="md" onFiles={() => {}} aria-label="subtle-md">
          Subtle md
        </FileButton>
        <FileButton disabled onFiles={() => {}} aria-label="disabled">
          Disabled
        </FileButton>
      </div>,
    );
    await expectAxeClean(container);
  });
});
