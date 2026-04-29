import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { FileButton } from './FileButton';

describe('FileButton', () => {
  it('renders the visible label as a focusable button', () => {
    render(
      <FileButton aria-label="Import lease" onFiles={() => {}}>
        Import lease
      </FileButton>,
    );
    const btn = screen.getByRole('button', { name: 'Import lease' });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveAttribute('aria-hidden');
  });

  it('exposes a hidden file input with the configured accept and multiple', () => {
    const { container } = render(
      <FileButton accept=".pdf" multiple aria-label="Pick" onFiles={() => {}}>
        Pick
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', '.pdf');
    expect(input).toHaveAttribute('multiple');
    // Hidden from layout AND a11y tree.
    expect(input).toHaveAttribute('aria-hidden', 'true');
    expect(input.style.display).toBe('none');
    expect(input.tabIndex).toBe(-1);
  });

  it('calls onFiles when a file is picked', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(
      <FileButton aria-label="Import lease" onFiles={onFiles}>
        Import
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lease.pdf', { type: 'application/pdf' });
    await user.upload(input, file);
    expect(onFiles).toHaveBeenCalledTimes(1);
    const fileList = onFiles.mock.calls[0]?.[0] as FileList;
    expect(fileList.length).toBe(1);
    expect(fileList[0]?.name).toBe('lease.pdf');
  });

  it('clicking the visible button forwards click to the hidden input', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(
      <FileButton aria-label="Pick" onFiles={onFiles}>
        Pick
      </FileButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Pick' }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('size md hits the 44px AAA tap-target floor; sm hits 32px', () => {
    const { rerender } = render(
      <FileButton size="md" aria-label="Md" onFiles={() => {}}>
        Md
      </FileButton>,
    );
    const btnMd = screen.getByRole('button', { name: 'Md' });
    expect(btnMd.className).toContain('h-11');
    rerender(
      <FileButton size="sm" aria-label="Sm" onFiles={() => {}}>
        Sm
      </FileButton>,
    );
    const btnSm = screen.getByRole('button', { name: 'Sm' });
    expect(btnSm.className).toContain('h-8');
  });

  it('disabled state disables both the button and the input', () => {
    const { container } = render(
      <FileButton disabled aria-label="Import" onFiles={() => {}}>
        Import
      </FileButton>,
    );
    const btn = screen.getByRole('button', { name: 'Import' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(btn).toBeDisabled();
    expect(input).toBeDisabled();
  });

  it('forwards aria-describedby to the button', () => {
    render(
      <FileButton aria-describedby="hint" aria-label="Pick" onFiles={() => {}}>
        Pick
      </FileButton>,
    );
    const btn = screen.getByRole('button', { name: 'Pick' });
    expect(btn).toHaveAttribute('aria-describedby', 'hint');
  });

  it('has no a11y violations across variants and sizes', async () => {
    const { container } = render(
      <div>
        <FileButton aria-label="default-md" onFiles={() => {}}>
          Default md
        </FileButton>
        <FileButton variant="ghost" size="sm" aria-label="ghost-sm" onFiles={() => {}}>
          Ghost sm
        </FileButton>
        <FileButton variant="subtle" size="md" aria-label="subtle-md" onFiles={() => {}}>
          Subtle md
        </FileButton>
        <FileButton disabled aria-label="disabled" onFiles={() => {}}>
          Disabled
        </FileButton>
      </div>,
    );
    await expectAxeClean(container);
  });
});
