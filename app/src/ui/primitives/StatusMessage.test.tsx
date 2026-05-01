import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectAxeClean } from '../../test/axe';
import { StatusMessage, type StatusTone } from './StatusMessage';

describe('StatusMessage', () => {
  it.each<[StatusTone, string]>([
    ['success', 'status'],
    ['error', 'alert'],
    ['info', 'status'],
    ['warn', 'status'],
  ])('renders tone=%s with role=%s', (tone, role) => {
    render(<StatusMessage tone={tone}>Saved.</StatusMessage>);
    const node = screen.getByRole(role);
    expect(node).toHaveTextContent('Saved.');
    expect(node.tagName).toBe('P');
  });

  it('forwards extra props (id, data-testid, aria-live override)', () => {
    render(
      <StatusMessage tone="info" id="hint" data-testid="hint" aria-live="off">
        hint
      </StatusMessage>,
    );
    const node = screen.getByTestId('hint');
    expect(node).toHaveAttribute('id', 'hint');
    expect(node).toHaveAttribute('aria-live', 'off');
  });

  it('merges className with tone classes', () => {
    render(
      <StatusMessage tone="success" className="mt-2">
        ok
      </StatusMessage>,
    );
    const node = screen.getByRole('status');
    expect(node.className).toContain('mt-2');
    expect(node.className).toContain('text-positive');
  });

  it('is axe-clean across every tone', async () => {
    const tones: StatusTone[] = ['success', 'error', 'info', 'warn'];
    for (const tone of tones) {
      const { container, unmount } = render(
        <StatusMessage tone={tone}>Status text for {tone}.</StatusMessage>,
      );
      await expectAxeClean(container);
      unmount();
    }
  });
});
