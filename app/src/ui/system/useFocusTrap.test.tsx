import { describe, it, expect } from 'vitest';
import { useRef, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useFocusTrap } from './useFocusTrap';

function Trap({ active = true, children }: { active?: boolean; children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div>
      <button type="button">outside-before</button>
      <div ref={ref} tabIndex={-1} data-testid="trap">
        {children}
      </div>
      <button type="button">outside-after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('Tab from last focusable cycles to first', async () => {
    const user = userEvent.setup();
    render(
      <Trap>
        <button type="button">first</button>
        <button type="button">middle</button>
        <button type="button">last</button>
      </Trap>,
    );
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from first focusable cycles to last', async () => {
    const user = userEvent.setup();
    render(
      <Trap>
        <button type="button">first</button>
        <button type="button">last</button>
      </Trap>,
    );
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });
    first.focus();
    expect(document.activeElement).toBe(first);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('does not trap when active is false', async () => {
    const user = userEvent.setup();
    render(
      <Trap active={false}>
        <button type="button">inside</button>
      </Trap>,
    );
    const inside = screen.getByRole('button', { name: 'inside' });
    inside.focus();
    await user.tab();
    // With trap inactive, Tab proceeds to the outside-after button.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'outside-after' }));
  });

  it('skips disabled buttons', async () => {
    const user = userEvent.setup();
    render(
      <Trap>
        <button type="button">first</button>
        <button type="button" disabled>
          disabled-middle
        </button>
        <button type="button">last</button>
      </Trap>,
    );
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from the container itself wraps to the last focusable (Codex regression)', async () => {
    const user = userEvent.setup();
    render(
      <Trap>
        <button type="button">first</button>
        <button type="button">last</button>
      </Trap>,
    );
    const trap = screen.getByTestId('trap');
    const first = screen.getByRole('button', { name: 'first' });
    const last = screen.getByRole('button', { name: 'last' });
    trap.focus();
    expect(document.activeElement).toBe(trap);
    await user.tab({ shift: true });
    // Without the wrap fix, focus would have escaped to outside-before.
    expect(document.activeElement).toBe(last);
    // And forward Tab from the root container goes to the first.
    trap.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);
  });
});
