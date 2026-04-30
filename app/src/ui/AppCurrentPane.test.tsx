import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppCurrentPane } from './AppCurrentPane';
import { I18nProvider } from '../i18n/I18nProvider';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

function makeDoc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [{ text: 'Tenant shall pay rent.', page: 1 }],
    sections: [],
    raw: 'Tenant shall pay rent.',
  };
}

function makeStatus() {
  return {
    kind: 'analyzed' as const,
    fileName: 'lease.pdf',
    bytes: null,
    leaseId: 'L1',
    result: {
      doc: makeDoc(),
      findings: [
        {
          ruleId: 'r1',
          severity: 'medium',
          category: 'general',
          title: 'Test finding',
          explanation: 'Why it matters',
          citation: null,
          page: 1,
          paragraphIndex: 0,
          snippet: 'Tenant shall pay rent.',
          span: { start: 0, end: 8 },
          confidence: 0.9,
          negated: false,
          rulePackVersion: '1.0.0',
        },
      ] as Finding[],
    },
  };
}

function defaults(over: Partial<React.ComponentProps<typeof AppCurrentPane>> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeRedline: any = {
    redlineEdits: [],
    editParagraph: vi.fn(),
    deleteParagraphEdit: vi.fn(),
    buildHtml: vi.fn(() => ''),
    replaceAll: vi.fn(),
    refresh: vi.fn(),
    applySuggestion: vi.fn(async () => undefined),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeCounters: any = {
    counterOffers: [],
    save: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeAnnotations: any = {
    annotations: [],
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
  };
  const props: React.ComponentProps<typeof AppCurrentPane> = {
    status: makeStatus(),
    selected: null,
    selectedPage: null,
    setSelected: vi.fn(),
    setSelectedPage: vi.fn(),
    ocrState: { kind: 'idle' },
    ocrLanguage: 'eng',
    setOcrLanguage: vi.fn(),
    ocrLanguages: [],
    hasSigningKey: false,
    glossaryEntries: [],
    templates: [],
    plainEnglishByRuleId: {},
    suggestedTextByRuleId: {},
    suggestedEditByRuleId: {},
    redline: fakeRedline,
    counters: fakeCounters,
    annotationsApi: fakeAnnotations,
    analyzedLeaseId: 'L1',
    onExportJson: vi.fn(),
    onExportSignedJson: vi.fn(),
    onBuildIcs: vi.fn(),
    onAttemptOcr: vi.fn(),
    onPromoteToStandard: vi.fn(),
    setView: vi.fn(),
    ...over,
  };
  return render(
    <I18nProvider>
      <AppCurrentPane {...props} />
    </I18nProvider>,
  );
}

describe('AppCurrentPane', () => {
  it('renders the analyzed-view scaffold (findings panel + workflow panel)', () => {
    defaults();
    expect(screen.getByRole('complementary', { name: /findings/i })).toBeInTheDocument();
    // WorkflowPanel mounts an .ics button.
    expect(screen.getByRole('button', { name: /\.ics/i })).toBeInTheDocument();
  });

  it('renders the signed-export button only when hasSigningKey is true', () => {
    const { rerender } = defaults({ hasSigningKey: false });
    expect(screen.queryByRole('button', { name: /signed/i })).toBeNull();
    rerender(
      <I18nProvider>
        <AppCurrentPane
          {...{
            status: makeStatus(),
            selected: null,
            selectedPage: null,
            setSelected: vi.fn(),
            setSelectedPage: vi.fn(),
            ocrState: { kind: 'idle' },
            ocrLanguage: 'eng',
            setOcrLanguage: vi.fn(),
            ocrLanguages: [],
            hasSigningKey: true,
            glossaryEntries: [],
            templates: [],
            plainEnglishByRuleId: {},
            suggestedTextByRuleId: {},
            suggestedEditByRuleId: {},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            redline: { redlineEdits: [], applySuggestion: vi.fn() } as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            counters: { counterOffers: [], save: vi.fn(), remove: vi.fn() } as any,

            annotationsApi: {
              annotations: [],
              save: vi.fn(),
              update: vi.fn(),
              remove: vi.fn(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            analyzedLeaseId: 'L1',
            onExportJson: vi.fn(),
            onExportSignedJson: vi.fn(),
            onBuildIcs: vi.fn(),
            onAttemptOcr: vi.fn(),
            onPromoteToStandard: vi.fn(),
            setView: vi.fn(),
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /signed/i })).toBeInTheDocument();
  });

  it('fires onExportJson when the JSON-export button is clicked', async () => {
    const onExportJson = vi.fn();
    defaults({ onExportJson });
    const btn = screen.getAllByRole('button').find((b) => /json/i.test(b.textContent ?? ''));
    expect(btn).toBeDefined();
    await userEvent.click(btn!);
    expect(onExportJson).toHaveBeenCalledTimes(1);
  });

  it('renders the OCR banner when the doc looks scanned', () => {
    const status = makeStatus();
    // Empty paragraphs / items make needsOcr fire.
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    defaults({ status });
    expect(screen.getByText(/looks scanned/i)).toBeInTheDocument();
  });

  it('defaults the document toggle to PDF mode when the lease needs OCR', () => {
    const status = makeStatus();
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    defaults({ status });
    expect(screen.getByRole('tab', { name: /^pdf$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the finding-detail modal when a finding is selected', () => {
    const finding = {
      ruleId: 'r1',
      severity: 'medium',
      category: 'general',
      title: 'Picked finding',
      explanation: 'Why it matters here',
      citation: null,
      page: 1,
      paragraphIndex: 0,
      snippet: 'Tenant shall pay rent.',
      span: { start: 0, end: 8 },
      confidence: 0.9,
      negated: false,
      rulePackVersion: '1.0.0',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaults({ selected: finding as any });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /picked finding/i })).toBeInTheDocument();
  });

  it('renders the OCR running progress when ocrState.kind is "running"', () => {
    const status = makeStatus();
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    defaults({
      status,
      ocrState: { kind: 'running', pct: 0.42, stage: 'recognizing' },
    });
    expect(screen.getByText(/Running OCR.*recognizing.*42%/i)).toBeInTheDocument();
  });

  // Wave 45-BE — aria inventory test. After the IA split, the four
  // landmarks listed in the AppCurrentPane header comment must still
  // be queryable from the coordinator. Wave 51-D promoted the
  // selected-finding article into a `role="dialog"` modal — same
  // landmark family, accessible-name preserved.
  it('preserves the four aria landmarks across the region split', () => {
    const status = makeStatus();
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    const finding = {
      ruleId: 'r1',
      severity: 'medium',
      category: 'general',
      title: 'Picked finding',
      explanation: 'Why it matters',
      citation: null,
      page: 1,
      paragraphIndex: 0,
      snippet: 'snippet',
      span: { start: 0, end: 1 },
      confidence: 0.9,
      negated: false,
      rulePackVersion: '1.0.0',
    };
    defaults({
      status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selected: finding as any,
      ocrState: { kind: 'error', message: 'no traineddata' },
    });
    // role="status" — outer ocr-banner div (other status regions may
    // exist in supporting panels; assert the ocr-banner one is present).
    const statuses = screen.getAllByRole('status');
    expect(statuses.some((el) => el.classList.contains('ocr-banner'))).toBe(true);
    // role="alert" — ocr-error paragraph (running state would emit
    // aria-live="polite" instead; we exercise error here so all three
    // can co-exist with the selected-finding card landmark).
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // role="dialog" — FindingDetailModal (replaces the old `<article
    // aria-label="selected finding">` landmark).
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('preserves the aria-live="polite" progress landmark in OCR running state', () => {
    const status = makeStatus();
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    defaults({
      status,
      ocrState: { kind: 'running', pct: 0.1, stage: 'init' },
    });
    const progress = screen.getByText(/Running OCR/i);
    expect(progress).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the OCR error alert when ocrState.kind is "error"', () => {
    const status = makeStatus();
    status.result.doc = {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [],
      sections: [],
      raw: '',
    };
    defaults({
      status,
      ocrState: { kind: 'error', message: 'no traineddata' },
    });
    // Wave 45-D — error copy rewritten from "OCR failed: <msg>" to plain
    // language ("OCR didn't finish reading this PDF…"). The underlying
    // message still surfaces.
    expect(screen.getByRole('alert')).toHaveTextContent(/no traineddata/);
    expect(screen.getByRole('alert')).toHaveTextContent(/ocr didn.{1,3}t finish reading/i);
  });
});
