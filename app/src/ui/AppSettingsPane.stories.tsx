import type { Meta, StoryObj } from '@storybook/react';
import { AppSettingsPane } from './AppSettingsPane';
import { I18nProvider } from '../i18n/I18nProvider';

const meta: Meta<typeof AppSettingsPane> = {
  title: 'App / AppSettingsPane',
  component: AppSettingsPane,
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof AppSettingsPane>;

export const Default: Story = {
  args: {
    onExportArchive: () => undefined,
    onImportArchive: () => undefined,
    onClearAll: () => undefined,
  },
};
