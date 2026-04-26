import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LibraryPanel } from '../LibraryPanel';
import { TemplatesPanel } from '../TemplatesPanel';
import { JurisdictionPickerPanel } from '../JurisdictionPickerPanel';

// Wave 28-D smoke test: every empty-state branch renders the
// EmptyState primitive (data-empty-description present) without
// errors. Keeps the polish wired even if individual panels mutate.

const noop = (): void => {};

describe('empty states (Wave 28-D)', () => {
  it('LibraryPanel empty branch uses EmptyState', () => {
    const { container } = render(
      <LibraryPanel
        leases={[]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText(/no saved leases/i)).toBeInTheDocument();
    expect(container.querySelector('[data-empty-description]')).not.toBeNull();
  });

  it('TemplatesPanel empty branch uses EmptyState', () => {
    const { container } = render(
      <TemplatesPanel
        templates={[]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/no clause templates saved yet/i)).toBeInTheDocument();
    expect(container.querySelector('[data-empty-description]')).not.toBeNull();
  });

  it('JurisdictionPickerPanel empty-available branch uses EmptyState', () => {
    const { container } = render(
      <JurisdictionPickerPanel
        available={[]}
        selected={[]}
        onChange={noop}
      />,
    );
    expect(screen.getByText(/no jurisdictions available/i)).toBeInTheDocument();
    expect(container.querySelector('[data-empty-description]')).not.toBeNull();
  });
});
