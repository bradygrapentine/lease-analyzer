import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineDot } from './OfflineDot';

describe('OfflineDot', () => {
  it('renders an accessible status label', () => {
    render(<OfflineDot />);
    expect(screen.getByRole('status', { name: /offline.*on-device/i })).toBeInTheDocument();
  });

  it('shows the visible "Offline · On-device" text', () => {
    render(<OfflineDot />);
    expect(screen.getByText(/offline.*on-device/i)).toBeInTheDocument();
  });
});
