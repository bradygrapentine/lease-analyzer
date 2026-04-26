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

  it('renders every accent variant', () => {
    for (const accent of ['high', 'medium', 'low', 'info'] as const) {
      const { unmount } = render(<Card accent={accent}>a</Card>);
      expect(screen.getByText('a')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders with no accent', () => {
    render(<Card>no accent</Card>);
    expect(screen.getByText('no accent')).toBeInTheDocument();
  });

  it('forwards aria-* props verbatim (e2e safety)', () => {
    render(<Card aria-label="test card" aria-describedby="desc">x</Card>);
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
        <Card accent="high" aria-label="high severity">urgent</Card>
      </div>,
    );
    await expectAxeClean(container);
  });
});
