import { describe, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { Field } from './Field';

describe('Field', () => {
  it('renders label and input', () => {
    render(<Field label="Note" />);
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('defaults to input element', () => {
    const { container } = render(<Field label="Name" />);
    expect(container.querySelector('input')).toBeInTheDocument();
  });

  it('renders textarea when as="textarea"', () => {
    const { container } = render(<Field label="Note" as="textarea" />);
    expect(container.querySelector('textarea')).toBeInTheDocument();
  });

  it('renders select when as="select"', () => {
    render(
      <Field label="Choice" as="select">
        <option value="a">A</option>
        <option value="b">B</option>
      </Field>,
    );
    expect(screen.getByRole('combobox', { name: /choice/i })).toBeInTheDocument();
  });

  it('renders description text when provided', () => {
    render(<Field label="Email" description="Enter your work email" />);
    expect(screen.getByText('Enter your work email')).toBeInTheDocument();
  });

  it('forwards aria-label verbatim (e2e safety)', () => {
    render(<Field label="Note" aria-label="new note" />);
    expect(screen.getByRole('textbox', { name: /new note/i })).toBeInTheDocument();
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(<Field label="Name" data-testid="name-field" />);
    expect(screen.getByTestId('name-field')).toBeInTheDocument();
  });

  it('accepts value and onChange (controlled input)', async () => {
    const onChange = vi.fn();
    render(<Field label="Search" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Search'), 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('has no a11y violations (input)', async () => {
    const { container } = render(<Field label="Name" />);
    await expectAxeClean(container);
  });

  it('has no a11y violations (textarea with description)', async () => {
    const { container } = render(
      <Field label="Notes" as="textarea" description="Add your notes here" />,
    );
    await expectAxeClean(container);
  });

  it('two Field instances on the same page get distinct description IDs (no collision)', () => {
    render(
      <>
        <Field as="input" label="Same" description="first" />
        <Field as="input" label="Same" description="second" />
      </>,
    );
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    const id1 = inputs[0]!.getAttribute('aria-describedby');
    const id2 = inputs[1]!.getAttribute('aria-describedby');
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});
