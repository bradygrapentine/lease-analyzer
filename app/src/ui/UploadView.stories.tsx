import type { Meta, StoryObj } from '@storybook/react';
import { UploadView } from './UploadView';
import { I18nProvider } from '../i18n/I18nProvider';

const meta: Meta<typeof UploadView> = {
  title: 'App / UploadView',
  component: UploadView,
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof UploadView>;

export const Default: Story = {
  args: {
    onUpload: () => undefined,
    onTrySample: () => undefined,
  },
};
