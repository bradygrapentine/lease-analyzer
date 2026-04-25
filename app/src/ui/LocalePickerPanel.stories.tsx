import type { Meta, StoryObj } from '@storybook/react';
import { LocalePickerPanel } from './LocalePickerPanel';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/I18nContext';

interface WrapperProps {
  initialLocale: Locale;
}

function Wrapper({ initialLocale }: WrapperProps): JSX.Element {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <LocalePickerPanel />
    </I18nProvider>
  );
}

const meta = {
  title: 'UI/LocalePickerPanel',
  component: Wrapper,
  args: {
    initialLocale: 'en',
  },
} satisfies Meta<typeof Wrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const English: Story = {
  args: { initialLocale: 'en' },
};

export const Spanish: Story = {
  args: { initialLocale: 'es' },
};
