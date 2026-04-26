import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectAxeClean } from '../../test/axe';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No leases yet" />);
    expect(screen.getByText('No leases yet')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <EmptyState
        title="No clause templates saved yet"
        description="Save snippets from a lease to build a library."
      />,
    );
    expect(
      screen.getByText('Save snippets from a lease to build a library.'),
    ).toBeInTheDocument();
  });

  it('omits the description when not provided', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector('[data-empty-description]')).toBeNull();
  });

  it('renders the action when provided', () => {
    render(
      <EmptyState
        title="No leases yet"
        action={<button type="button">Upload a lease</button>}
      />,
    );
    expect(screen.getByRole('button', { name: /upload a lease/i })).toBeInTheDocument();
  });

  it('omits the action region when not provided', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector('[data-empty-action]')).toBeNull();
  });

  it('renders the icon slot when provided', () => {
    render(
      <EmptyState
        title="Nothing here"
        icon={<svg data-testid="glyph" aria-hidden="true" />}
      />,
    );
    expect(screen.getByTestId('glyph')).toBeInTheDocument();
  });

  it('omits the icon wrapper when icon is not provided', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector('[data-empty-icon]')).toBeNull();
  });

  it('has no a11y violations with all slots populated', async () => {
    const { container } = render(
      <EmptyState
        title="No leases yet"
        description="Drop a PDF here to get started."
        icon={<svg aria-hidden="true" width="32" height="32" />}
        action={<button type="button">Upload</button>}
      />,
    );
    await expectAxeClean(container);
  });

  it('has no a11y violations with title only', async () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    await expectAxeClean(container);
  });
});
