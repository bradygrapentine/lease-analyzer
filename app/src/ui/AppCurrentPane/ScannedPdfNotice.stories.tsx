import type { Meta, StoryObj } from '@storybook/react';
import { ScannedPdfNotice } from './ScannedPdfNotice';

const meta = {
  title: 'UI/AppCurrentPane/ScannedPdfNotice',
  component: ScannedPdfNotice,
  args: {
    ocr: { likelyScanned: true, avgCharsPerPage: 4, threshold: 100 },
    ocrLanguage: 'eng',
    ocrLanguages: [],
    setOcrLanguage: () => {},
    hasBytes: true,
    onAttemptOcr: () => {},
  },
} satisfies Meta<typeof ScannedPdfNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { ocrState: { kind: 'idle' } },
};

export const Running: Story = {
  args: { ocrState: { kind: 'running', pct: 0.42, stage: 'recognizing' } },
};

export const Error: Story = {
  args: { ocrState: { kind: 'error', message: 'no traineddata' } },
};
