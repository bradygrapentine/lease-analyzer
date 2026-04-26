import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { SectionGroup } from './SectionGroup';

describe('SectionGroup', () => {
  it('renders title and children when defaultOpen is true', () => {
    render(
      <SectionGroup id="grp" title="This Lease" defaultOpen>
        <p>inner content</p>
      </SectionGroup>,
    );
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('inner content')).toBeInTheDocument();
  });

  it('hides children when defaultOpen is false', () => {
    render(
      <SectionGroup id="grp" title="Library" defaultOpen={false}>
        <p>hidden body</p>
      </SectionGroup>,
    );
    expect(screen.getByRole('button', { name: /library/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('hidden body')).toBeNull();
  });

  it('toggles aria-expanded on click', async () => {
    render(
      <SectionGroup id="grp" title="Governance" defaultOpen={false}>
        <p>secret</p>
      </SectionGroup>,
    );
    const toggle = screen.getByRole('button', { name: /governance/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('secret')).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('secret')).toBeNull();
  });

  it('renders numeric count badge', () => {
    render(
      <SectionGroup id="grp" title="Library" count={8}>
        <p>x</p>
      </SectionGroup>,
    );
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders string count badge', () => {
    render(
      <SectionGroup id="grp" title="Library" count="3 pending">
        <p>x</p>
      </SectionGroup>,
    );
    expect(screen.getByText('3 pending')).toBeInTheDocument();
  });

  it('omits the count badge when count is undefined', () => {
    const { container } = render(
      <SectionGroup id="grp" title="Library">
        <p>x</p>
      </SectionGroup>,
    );
    expect(container.querySelector('[data-section-count]')).toBeNull();
  });

  it('uses compact density when requested', () => {
    const { container } = render(
      <SectionGroup id="grp" title="Library" density="compact">
        <p>x</p>
      </SectionGroup>,
    );
    expect(container.querySelector('[data-density="compact"]')).not.toBeNull();
  });

  it('defaults to comfortable density', () => {
    const { container } = render(
      <SectionGroup id="grp" title="Library">
        <p>x</p>
      </SectionGroup>,
    );
    expect(container.querySelector('[data-density="comfortable"]')).not.toBeNull();
  });

  it('wires aria-controls to the panel id derived from id', () => {
    render(
      <SectionGroup id="lib" title="Library">
        <p>body</p>
      </SectionGroup>,
    );
    const toggle = screen.getByRole('button', { name: /library/i });
    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId as string)).not.toBeNull();
  });

  it('has no a11y violations when expanded', async () => {
    const { container } = render(
      <SectionGroup id="grp" title="This Lease" defaultOpen>
        <p>inner</p>
      </SectionGroup>,
    );
    await expectAxeClean(container);
  });

  it('has no a11y violations when collapsed', async () => {
    const { container } = render(
      <SectionGroup id="grp" title="This Lease" defaultOpen={false}>
        <p>hidden</p>
      </SectionGroup>,
    );
    await expectAxeClean(container);
  });
});
