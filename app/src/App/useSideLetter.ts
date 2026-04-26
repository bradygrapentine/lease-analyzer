import { useCallback, useState } from 'react';
import { buildSideLetterHtml, type SideLetterSigner } from '../negotiation/sideLetter';
import { buildSideLetterPdf } from '../workflow/sideLetterPdf';
import type { RedlineEdit } from '../redline/redline';
import { downloadBlob, downloadBlobBytes, stripPdfExt } from './appHelpers';

export interface SideLetterSignerDraft {
  name: string;
  title: string;
}

export interface SideLetterRenderInput {
  leaseName: string;
  edits: RedlineEdit[];
  sectionFor?: (paragraphIndex: number) => string | undefined;
}

export interface UseSideLetterApi {
  signerDraft: SideLetterSignerDraft;
  setSignerDraft: (draft: SideLetterSignerDraft) => void;
  /** Pure HTML render (no side effects); shared by preview + download. */
  buildHtml: (input: SideLetterRenderInput) => string;
  /** Current in-panel preview HTML, or null when nothing has been generated. */
  previewHtml: string | null;
  /** Render the side-letter HTML and stash it for in-panel iframe display. */
  preview: (input: SideLetterRenderInput) => void;
  /** Hide the in-panel preview without re-rendering. */
  clearPreview: () => void;
  /** Download the rendered side-letter HTML as a file. */
  download: (input: SideLetterRenderInput) => void;
  /** Download the rendered side-letter as a PDF. */
  downloadPdf: (input: SideLetterRenderInput) => Promise<void>;
}

function trimmedSigner(draft: SideLetterSignerDraft): SideLetterSigner | undefined {
  if (draft.name.trim() === '') return undefined;
  const out: SideLetterSigner = { name: draft.name.trim() };
  const title = draft.title.trim();
  if (title !== '') out.title = title;
  return out;
}

export function useSideLetter(): UseSideLetterApi {
  const [signerDraft, setSignerDraft] = useState<SideLetterSignerDraft>({
    name: '',
    title: '',
  });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const buildHtmlForInput = useCallback(
    (input: SideLetterRenderInput): string => {
      const signer = trimmedSigner(signerDraft);
      return buildSideLetterHtml({
        leaseName: input.leaseName,
        edits: input.edits,
        sectionFor: input.sectionFor ?? ((): string | undefined => undefined),
        ...(signer !== undefined ? { signer } : {}),
      });
    },
    [signerDraft],
  );

  const preview = useCallback<UseSideLetterApi['preview']>(
    (input) => {
      setPreviewHtml(buildHtmlForInput(input));
    },
    [buildHtmlForInput],
  );

  const clearPreview = useCallback((): void => {
    setPreviewHtml(null);
  }, []);

  const download = useCallback<UseSideLetterApi['download']>(
    (input) => {
      const html = buildHtmlForInput(input);
      downloadBlob(html, 'text/html', `${stripPdfExt(input.leaseName)}-side-letter.html`);
    },
    [buildHtmlForInput],
  );

  const downloadPdf = useCallback<UseSideLetterApi['downloadPdf']>(
    async (input) => {
      const signer = trimmedSigner(signerDraft);
      const bytes = await buildSideLetterPdf({
        leaseName: input.leaseName,
        edits: input.edits,
        sectionFor: input.sectionFor ?? ((): string | undefined => undefined),
        ...(signer !== undefined ? { signer } : {}),
      });
      downloadBlobBytes(
        bytes,
        'application/pdf',
        `${stripPdfExt(input.leaseName)}-side-letter.pdf`,
      );
    },
    [signerDraft],
  );

  return {
    signerDraft,
    setSignerDraft,
    buildHtml: buildHtmlForInput,
    previewHtml,
    preview,
    clearPreview,
    download,
    downloadPdf,
  };
}
