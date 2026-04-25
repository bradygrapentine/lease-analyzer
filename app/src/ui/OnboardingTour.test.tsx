import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingTour } from './OnboardingTour';

describe('OnboardingTour', () => {
  it('renders the first step on initial mount when dismissedAt is null', () => {
    render(<OnboardingTour dismissedAt={null} onDismiss={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /local-first by design/i }),
    ).toBeInTheDocument();
  });

  it('walks through all 4 steps via Next and back via Back', async () => {
    const user = userEvent.setup();
    render(<OnboardingTour dismissedAt={null} onDismiss={() => {}} />);
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /ocr is opt-in/i }),
    ).toBeInTheDocument();
    // Back returns to step 3.
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
  });

  it('clicking Got it on the last step calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OnboardingTour dismissedAt={null} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /finish onboarding tour/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('returns null when dismissedAt is already set (second mount)', () => {
    const { container } = render(
      <OnboardingTour dismissedAt={1_700_000_000_000} onDismiss={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape key dismisses the tour', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OnboardingTour dismissedAt={null} onDismiss={onDismiss} />);
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Skip button dismisses immediately from any step', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OnboardingTour dismissedAt={null} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /skip onboarding tour/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('action buttons are focusable (tabIndex=0)', () => {
    render(<OnboardingTour dismissedAt={null} onDismiss={() => {}} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('tabindex')).not.toBe('-1');
    }
    cleanup();
  });
});
