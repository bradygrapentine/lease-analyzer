import { describe, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { Section } from './Section';

describe('Section', () => {
  it('renders children with the given label', () => {
    render(<Section label="Findings">body text</Section>);
    expect(screen.getByRole('region', { name: /findings/i })).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });

  it('uses aria-label on the section element', () => {
    render(<Section label="Annotations">content</Section>);
    const section = screen.getByRole('region', { name: /annotations/i });
    expect(section).toHaveAttribute('aria-label', 'Annotations');
  });

  it('renders collapsible section expanded by default', () => {
    render(
      <Section label="Details" collapsible>
        inner
      </Section>,
    );
    expect(screen.getByText('inner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('toggles collapsed state on click', async () => {
    render(
      <Section label="Details" collapsible>
        inner
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: /details/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('inner')).toBeNull();
  });

  it('respects defaultExpanded=false', () => {
    render(
      <Section label="Details" collapsible defaultExpanded={false}>
        inner
      </Section>,
    );
    expect(screen.queryByText('inner')).toBeNull();
    expect(screen.getByRole('button', { name: /details/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('forwards aria-* props verbatim (e2e safety)', () => {
    render(
      <Section label="Test" aria-describedby="ext-desc">
        x
      </Section>,
    );
    expect(screen.getByRole('region', { name: /test/i })).toHaveAttribute(
      'aria-describedby',
      'ext-desc',
    );
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(
      <Section label="Test" data-testid="my-section">
        x
      </Section>,
    );
    expect(screen.getByTestId('my-section')).toBeInTheDocument();
  });

  it('has no a11y violations (non-collapsible)', async () => {
    const { container } = render(<Section label="Plain">content</Section>);
    await expectAxeClean(container);
  });

  it('has no a11y violations (collapsible expanded)', async () => {
    const { container } = render(
      <Section label="Collapsible" collapsible>
        content
      </Section>,
    );
    await expectAxeClean(container);
  });
});
