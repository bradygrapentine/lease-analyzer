import { describe, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectAxeClean } from '../../test/axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>High</Badge>);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders severity variant with each severity level', () => {
    for (const severity of ['high', 'medium', 'low', 'info'] as const) {
      const { unmount } = render(
        <Badge variant="severity" severity={severity}>
          {severity}
        </Badge>,
      );
      expect(screen.getByText(severity)).toBeInTheDocument();
      unmount();
    }
  });

  it('severity variant renders an aria-hidden icon alongside the label', () => {
    const { container } = render(
      <Badge variant="severity" severity="high">
        High
      </Badge>,
    );
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // The text label still survives next to the icon.
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('severity variant uses tinted bg + ink-on-tint foreground (DESIGN.md §5)', () => {
    const { container } = render(
      <Badge variant="severity" severity="medium">
        Medium
      </Badge>,
    );
    const span = container.firstChild as HTMLElement;
    // Classes derive from --color-severity-bg-* and --color-severity-border-*
    // tokens declared in app/src/index.css. The foreground is always text-fg
    // (Ink Black) for AA contrast against the tinted bg.
    expect(span.className).toMatch(/bg-\[var\(--color-severity-bg-warn\)\]/);
    expect(span.className).toMatch(/text-fg\b/);
    expect(span.className).toMatch(/border-\[var\(--color-severity-border-warn\)\]/);
    // No side-stripe doctrine: no border-l-N where N > 1.
    expect(span.className).not.toMatch(/border-l-(\[?[2-9]\d*)/);
  });

  it('severity variant uses bg-low / border-low for low severity', () => {
    const { container } = render(
      <Badge variant="severity" severity="low">
        Low
      </Badge>,
    );
    const span = container.firstChild as HTMLElement;
    expect(span.className).toMatch(/bg-\[var\(--color-severity-bg-low\)\]/);
    expect(span.className).toMatch(/border-\[var\(--color-severity-border-low\)\]/);
  });

  it('renders outline variant (default)', () => {
    render(<Badge variant="outline">outline</Badge>);
    expect(screen.getByText('outline')).toBeInTheDocument();
  });

  it('renders mono variant', () => {
    render(<Badge variant="mono">analyze</Badge>);
    expect(screen.getByText('analyze')).toBeInTheDocument();
  });

  it('renders severity variant without explicit severity prop (neutral)', () => {
    render(<Badge variant="severity">unknown</Badge>);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('forwards aria-label verbatim (e2e safety)', () => {
    render(<Badge aria-label="severity: high">High</Badge>);
    expect(screen.getByLabelText('severity: high')).toBeInTheDocument();
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(<Badge data-testid="my-badge">x</Badge>);
    expect(screen.getByTestId('my-badge')).toBeInTheDocument();
  });

  it('merges extra className', () => {
    const { container } = render(<Badge className="extra-class">x</Badge>);
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('has no a11y violations across variants', async () => {
    const { container } = render(
      <div>
        <Badge variant="severity" severity="high">
          High
        </Badge>
        <Badge variant="severity" severity="medium">
          Medium
        </Badge>
        <Badge variant="severity" severity="low">
          Low
        </Badge>
        <Badge variant="severity" severity="info">
          Info
        </Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="mono">mono</Badge>
      </div>,
    );
    await expectAxeClean(container);
  });
});
