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
        <Badge variant="severity" severity="high">High</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="mono">mono</Badge>
      </div>,
    );
    await expectAxeClean(container);
  });
});
