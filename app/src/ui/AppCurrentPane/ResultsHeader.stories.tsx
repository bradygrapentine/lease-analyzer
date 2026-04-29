import type { Meta, StoryObj } from '@storybook/react';
import { ResultsHeader } from './ResultsHeader';
import { I18nProvider } from '../../i18n/I18nProvider';

const meta = {
  title: 'UI/AppCurrentPane/ResultsHeader',
  component: ResultsHeader,
  decorators: [
    (Story): JSX.Element => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
  args: {
    hasSigningKey: true,
    onExportJson: () => {},
    onExportSignedJson: () => {},
    onExportHtml: () => {},
  },
} satisfies Meta<typeof ResultsHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSigningKey: Story = {};

export const WithoutSigningKey: Story = {
  args: { hasSigningKey: false },
};
