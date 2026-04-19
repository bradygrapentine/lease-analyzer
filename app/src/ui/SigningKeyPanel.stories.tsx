import type { Meta, StoryObj } from '@storybook/react';
import { SigningKeyPanel } from './SigningKeyPanel';

const meta = {
  title: 'UI/SigningKeyPanel',
  component: SigningKeyPanel,
  args: {
    onCreateKey: (pp: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] createSigningKey with passphrase length', pp.length);
    },
    onExportPublicKey: (pk: string) => {
      // eslint-disable-next-line no-console
      console.log('[stories] export public key', pk);
    },
  },
} satisfies Meta<typeof SigningKeyPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoKey: Story = {
  args: {
    state: { publicKey: null },
  },
};

export const WithKey: Story = {
  args: {
    state: {
      publicKey: 'f0rX2Tv1tNnZuV2qQ1KjP8eLq3oRjY7pSbB4kWc6hUA=',
    },
  },
};
