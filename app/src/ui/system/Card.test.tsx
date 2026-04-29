import { describe, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectAxeClean } from '../../test/axe';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello card</Card>);
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('defaults to div when no aria-label', () => {
    const { container } = render(<Card>content</Card>);
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(container.querySelector('article')).toBeNull();
  });

  it('renders as article when aria-label is set', () => {
    render(<Card aria-label="selected finding">detail</Card>);
    expect(screen.getByRole('article', { name: /selected finding/i })).toBeInTheDocument();
  });

  it('renders every severity variant with tinted bg + matching border (no side stripe)', () => {
    const cases = [
      {
        variant: 'severity-high' as const,
        bgToken: 'severity-bg-error',
        borderToken: 'severity-border-error',
      },
      {
        variant: 'severity-medium' as const,
        bgToken: 'severity-bg-warn',
        borderToken: 'severity-border-warn',
      },
      {
        variant: 'severity-low' as const,
        bgToken: 'severity-bg-low',
        borderToken: 'severity-border-low',
      },
      {
        variant: 'severity-info' as const,
        bgToken: 'severity-bg-info',
        borderToken: 'severity-border-info',
      },
    ];
    for (const { variant, bgToken, borderToken } of cases) {
      const { container, unmount } = render(<Card variant={variant}>row</Card>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain(`bg-[var(--color-${bgToken})]`);
      expect(el.className).toContain(`border-[var(--color-${borderToken})]`);
      // No side-stripe doctrine: any border-l-N where N > 1 is forbidden.
      expect(el.className).not.toMatch(/border-l-(\[?[2-9]\d*)/);
      unmount();
    }
  });

  it('renders default variant with paper-raised + rule border', () => {
    const { container } = render(<Card>default</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('bg-paper-raised');
    expect(el.className).toContain('border-rule');
  });

  it('forwards aria-* props verbatim (e2e safety)', () => {
    render(
      <Card aria-label="test card" aria-describedby="desc">
        x
      </Card>,
    );
    const el = screen.getByRole('article', { name: /test card/i });
    expect(el).toHaveAttribute('aria-describedby', 'desc');
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(<Card data-finding-key="rule-1-0">x</Card>);
    expect(screen.getByText('x').closest('div')).toHaveAttribute('data-finding-key', 'rule-1-0');
  });

  it('accepts an explicit as prop override', () => {
    const { container } = render(<Card as="section">x</Card>);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Card>plain</Card>
        <Card aria-label="finding">with label</Card>
        <Card variant="severity-high" aria-label="high severity">
          urgent
        </Card>
      </div>,
    );
    await expectAxeClean(container);
  });
});
