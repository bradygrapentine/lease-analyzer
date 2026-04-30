import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ReaderPdfToggle, type ReaderPdfMode } from './ReaderPdfToggle';
import { I18nProvider } from '../i18n/I18nProvider';

const meta = {
  title: 'AppCurrentPane/ReaderPdfToggle',
  component: ReaderPdfToggle,
  decorators: [
    (Story): JSX.Element => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
} satisfies Meta<typeof ReaderPdfToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive(): JSX.Element {
  const [mode, setMode] = useState<ReaderPdfMode>('reader');
  return <ReaderPdfToggle mode={mode} onChange={setMode} />;
}

export const ReaderActive: Story = {
  args: { mode: 'reader', onChange: () => {} },
};

export const PdfActive: Story = {
  args: { mode: 'pdf', onChange: () => {} },
};

export const InteractiveStory: Story = {
  render: () => <Interactive />,
  args: { mode: 'reader', onChange: () => {} },
};
