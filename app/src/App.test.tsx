import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders heading and upload control', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /leaseguard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument();
  });
});
