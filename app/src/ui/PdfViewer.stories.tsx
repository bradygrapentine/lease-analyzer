import type { Meta, StoryObj } from '@storybook/react';
import { PdfViewer } from './PdfViewer';
import type { PageText } from '../parser/types';

// Dummy page text (no actual pdf bytes — canvases just show empty, but the
// highlight overlay renders correctly because it only needs page dimensions).
const dummyPages: PageText[] = [
  { pageNumber: 1, width: 600, height: 800, items: [] },
  { pageNumber: 2, width: 600, height: 800, items: [] },
];

const meta = {
  title: 'UI/PdfViewer',
  component: PdfViewer,
} satisfies Meta<typeof PdfViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    bytes: null,
    pageCount: 0,
    selectedPage: null,
  },
};

export const TwoPagesWithHighlight: Story = {
  args: {
    bytes: null,
    pageCount: 2,
    selectedPage: 2,
    pages: dummyPages,
    highlight: {
      page: 2,
      xLeft: 80,
      xRight: 520,
      yTop: 720,
      yBottom: 680,
    },
  },
};
