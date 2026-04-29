import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScannedPdfNotice } from './ScannedPdfNotice';

const scannedVerdict = { likelyScanned: true, avgCharsPerPage: 5, threshold: 100 };
const cleanVerdict = { likelyScanned: false, avgCharsPerPage: 800, threshold: 100 };

function setup(over: Partial<React.ComponentProps<typeof ScannedPdfNotice>> = {}) {
  const props: React.ComponentProps<typeof ScannedPdfNotice> = {
    ocr: scannedVerdict,
    ocrState: { kind: 'idle' },
    ocrLanguage: 'eng',
    ocrLanguages: [],
    setOcrLanguage: vi.fn(),
    hasBytes: true,
    onAttemptOcr: vi.fn(),
    ...over,
  };
  return render(<ScannedPdfNotice {...props} />);
}

describe('ScannedPdfNotice', () => {
  it('renders nothing when ocr.likelyScanned is false', () => {
    const { container } = setup({ ocr: cleanVerdict });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the role="status" banner in idle state with no progress/alert', () => {
    setup({ ocrState: { kind: 'idle' } });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/running ocr/i)).toBeNull();
  });

  it('renders the aria-live="polite" progress paragraph in running state', () => {
    setup({ ocrState: { kind: 'running', pct: 0.5, stage: 'recognizing' } });
    const progress = screen.getByText(/Running OCR.*recognizing.*50%/i);
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the role="alert" error paragraph in error state', () => {
    setup({ ocrState: { kind: 'error', message: 'bad data' } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/bad data/);
    expect(alert).toHaveTextContent(/ocr didn.{1,3}t finish reading/i);
  });

  it('pairs the OCR-error alert with a high-severity badge (color-not-alone)', () => {
    setup({ ocrState: { kind: 'error', message: 'bad data' } });
    // Badge label is the visible signal that pairs with the alert body.
    expect(screen.getByText(/OCR failed/i)).toBeInTheDocument();
    // Alert is still present (badge does not absorb the landmark).
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides the Attempt OCR button when hasBytes is false', () => {
    setup({ hasBytes: false });
    expect(screen.queryByRole('button', { name: /attempt ocr/i })).toBeNull();
  });

  it('hides the Attempt OCR button while OCR is running', () => {
    setup({ ocrState: { kind: 'running', pct: 0.1, stage: 'init' } });
    expect(screen.queryByRole('button', { name: /attempt ocr/i })).toBeNull();
  });
});
