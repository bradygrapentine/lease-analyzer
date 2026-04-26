import { createRef } from 'react';
import { describe, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectAxeClean } from '../../test/axe';
import { Button } from './Button';

describe('Button', () => {
  it('renders children with default variant + size', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders every variant cleanly', () => {
    for (const v of ['default', 'ghost', 'subtle'] as const) {
      const { unmount } = render(<Button variant={v}>{v}</Button>);
      expect(screen.getByRole('button', { name: v })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders both sizes cleanly', () => {
    for (const s of ['sm', 'md'] as const) {
      const { unmount } = render(<Button size={s}>{s}</Button>);
      expect(screen.getByRole('button', { name: s })).toBeInTheDocument();
      unmount();
    }
  });

  it('threads the pressed state to aria-pressed', () => {
    render(<Button pressed>Filter</Button>);
    expect(screen.getByRole('button', { name: /filter/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('forwards aria-label verbatim (e2e safety)', () => {
    render(<Button aria-label="rename Sample lease.pdf">edit</Button>);
    expect(screen.getByRole('button', { name: /rename sample lease\.pdf/i })).toBeInTheDocument();
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(<Button data-finding-key="rule-0-0">click</Button>);
    expect(screen.getByRole('button', { name: /click/i })).toHaveAttribute(
      'data-finding-key',
      'rule-0-0',
    );
  });

  it('defaults type to "button" so it never submits an enclosing form', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('respects an explicit type override', () => {
    render(<Button type="submit">x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>x</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards a ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has no a11y violations across all variants', async () => {
    const { container } = render(
      <div>
        <Button variant="default">A</Button>
        <Button variant="ghost">B</Button>
        <Button variant="subtle">C</Button>
        <Button pressed>P</Button>
      </div>,
    );
    await expectAxeClean(container);
  });
});
