import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JurisdictionPickerPanel } from './JurisdictionPickerPanel';

describe('JurisdictionPickerPanel', () => {
  it('renders the empty state when no jurisdictions are available', () => {
    render(
      <JurisdictionPickerPanel available={[]} selected={[]} onChange={() => {}} />,
    );
    expect(screen.getByText(/no jurisdictions available/i)).toBeInTheDocument();
  });

  it('renders a checkbox per available code with the correct checked state', () => {
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY', 'UK-ENG']}
        selected={['US-NY']}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('checkbox', { name: /jurisdiction US-CA/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /jurisdiction US-NY/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /jurisdiction UK-ENG/i }),
    ).not.toBeChecked();
  });

  it('shows the "no filter" helper text when selected is empty', () => {
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY']}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/no jurisdictions selected/i),
    ).toBeInTheDocument();
  });

  it('shows a count summary when at least one jurisdiction is selected', () => {
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY']}
        selected={['US-CA']}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it('calls onChange with the added code in available order when a box is checked', async () => {
    const onChange = vi.fn();
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY', 'UK-ENG']}
        selected={['UK-ENG']}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /jurisdiction US-CA/i }),
    );
    // Order must follow `available`, not the order the user clicked them in.
    expect(onChange).toHaveBeenCalledWith(['US-CA', 'UK-ENG']);
  });

  it('calls onChange with the code removed when a checked box is unchecked', async () => {
    const onChange = vi.fn();
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY']}
        selected={['US-CA', 'US-NY']}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /jurisdiction US-CA/i }),
    );
    expect(onChange).toHaveBeenCalledWith(['US-NY']);
  });

  it('clears selection when the clear button is pressed', async () => {
    const onChange = vi.fn();
    render(
      <JurisdictionPickerPanel
        available={['US-CA', 'US-NY']}
        selected={['US-CA']}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /clear jurisdiction selection/i }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables the clear button when no jurisdictions are selected', () => {
    render(
      <JurisdictionPickerPanel
        available={['US-CA']}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /clear jurisdiction selection/i }),
    ).toBeDisabled();
  });

  it('is keyboard operable — toggling a checkbox via Space fires onChange', async () => {
    const onChange = vi.fn();
    render(
      <JurisdictionPickerPanel
        available={['US-CA']}
        selected={[]}
        onChange={onChange}
      />,
    );
    const box = screen.getByRole('checkbox', { name: /jurisdiction US-CA/i });
    box.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(['US-CA']);
  });
});
