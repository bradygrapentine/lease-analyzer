import type { Meta, StoryObj } from '@storybook/react';
import { OcrLanguagePickerPanel } from './OcrLanguagePickerPanel';

const meta = {
  title: 'UI/OcrLanguagePickerPanel',
  component: OcrLanguagePickerPanel,
  args: {
    onChange: () => {},
  },
} satisfies Meta<typeof OcrLanguagePickerPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    available: [],
    selected: 'eng',
  },
};

export const SingleLanguage: Story = {
  args: {
    available: [{ code: 'eng', label: 'English' }],
    selected: 'eng',
  },
};

export const MultipleLanguages: Story = {
  args: {
    available: [
      { code: 'eng', label: 'English' },
      { code: 'spa', label: 'Spanish' },
      { code: 'fra', label: 'French' },
    ],
    selected: 'eng',
  },
};
