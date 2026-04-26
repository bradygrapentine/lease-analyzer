import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './AppHeader';
import { I18nProvider } from '../i18n/I18nProvider';

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const defaults: React.ComponentProps<typeof AppHeader> = {
    view: 'current',
    showRedlineToggle: false,
    onUpload: vi.fn(),
    onTrySample: vi.fn(),
    onViewChange: vi.fn(),
  };
  return render(
    <I18nProvider>
      <AppHeader {...defaults} {...props} />
    </I18nProvider>,
  );
}

describe('AppHeader', () => {
  it('renders title, upload control, sample-lease button, and view-mode tablist', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: /leaseguard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try a sample lease/i })).toBeInTheDocument();
    // Wave 29-E — view-mode shell is now a tablist.
    expect(screen.getByRole('tablist', { name: /view mode/i })).toBeInTheDocument();
  });

  it('marks the active view-mode tab with aria-selected=true', () => {
    renderHeader({ view: 'portfolio' });
    const portfolio = screen.getByRole('tab', { name: /portfolio/i });
    const current = screen.getByRole('tab', { name: /current lease/i });
    expect(portfolio).toHaveAttribute('aria-selected', 'true');
    expect(portfolio).toHaveAttribute('aria-controls', 'viewmode-panel-portfolio');
    // aria-pressed is dropped when role="tab" is set (axe aria-allowed-attr).
    expect(portfolio).not.toHaveAttribute('aria-pressed');
    expect(current).toHaveAttribute('aria-selected', 'false');
  });

  it('hides the redline view-mode tab until showRedlineToggle is true', () => {
    const { rerender } = renderHeader({ showRedlineToggle: false });
    expect(screen.queryByRole('tab', { name: /redline/i })).toBeNull();
    rerender(
      <I18nProvider>
        <AppHeader
          view="current"
          showRedlineToggle={true}
          onUpload={vi.fn()}
          onTrySample={vi.fn()}
          onViewChange={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('tab', { name: /redline/i })).toBeInTheDocument();
  });

  it('fires onViewChange when a view-mode tab is clicked', async () => {
    const onViewChange = vi.fn();
    renderHeader({ showRedlineToggle: true, onViewChange });
    await userEvent.click(screen.getByRole('tab', { name: /portfolio/i }));
    expect(onViewChange).toHaveBeenCalledWith('portfolio');
  });

  it('fires onTrySample when the sample-lease button is clicked', async () => {
    const onTrySample = vi.fn();
    renderHeader({ onTrySample });
    await userEvent.click(screen.getByRole('button', { name: /try a sample lease/i }));
    expect(onTrySample).toHaveBeenCalledTimes(1);
  });

  it('fires onUpload with the selected file when a PDF is chosen', async () => {
    const onUpload = vi.fn();
    renderHeader({ onUpload });
    const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });
});
