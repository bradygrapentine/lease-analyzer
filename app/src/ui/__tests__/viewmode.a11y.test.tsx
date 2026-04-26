// Wave 29 Part E — axe-core scan for the view-mode shell.
//
// Asserts the AppHeader renders the view-mode toggle as a proper
// `role="tablist"` with `role="tab"` children carrying `aria-selected`
// and `aria-controls` pointing at a matching `role="tabpanel"`. Also
// verifies axe-clean rendering for both the two-tab (no redline) and
// three-tab (with redline) configurations.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../AppHeader';
import { I18nProvider } from '../../i18n/I18nProvider';
import { expectAxeClean } from '../../test/axe';

function renderShell(view: 'current' | 'portfolio' | 'redline', showRedlineToggle: boolean) {
  return render(
    <I18nProvider>
      <AppHeader
        view={view}
        showRedlineToggle={showRedlineToggle}
        onUpload={() => {}}
        onTrySample={() => {}}
        onViewChange={() => {}}
      />
      {/* Matching tabpanels with the same ids the tabs reference, so
          aria-controls resolves and axe doesn't flag a dangling ref. */}
      {view === 'current' && (
        <div role="tabpanel" id="viewmode-panel-current" aria-labelledby="viewmode-tab-current">
          current
        </div>
      )}
      {view === 'portfolio' && (
        <div role="tabpanel" id="viewmode-panel-portfolio" aria-labelledby="viewmode-tab-portfolio">
          portfolio
        </div>
      )}
      {view === 'redline' && showRedlineToggle && (
        <div role="tabpanel" id="viewmode-panel-redline" aria-labelledby="viewmode-tab-redline">
          redline
        </div>
      )}
    </I18nProvider>,
  );
}

describe('view-mode shell a11y (Wave 29-E)', () => {
  it('renders a tablist with selected tab + matching tabpanel (two tabs)', () => {
    renderShell('current', false);
    const tablist = screen.getByRole('tablist', { name: /view mode/i });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();
    expect(selected?.getAttribute('aria-controls')).toBe('viewmode-panel-current');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'viewmode-tab-current');
  });

  it('exposes three tabs when redline is enabled', () => {
    renderShell('redline', true);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /redline/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('axe-clean: two-tab configuration', async () => {
    const { container } = renderShell('current', false);
    await expectAxeClean(container);
  });

  it('axe-clean: three-tab configuration with redline', async () => {
    const { container } = renderShell('portfolio', true);
    await expectAxeClean(container);
  });
});
