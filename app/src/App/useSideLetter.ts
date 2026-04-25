import { useCallback, useState } from 'react';
import {
  buildSideLetterHtml,
  type SideLetterSigner,
} from '../negotiation/sideLetter';
import type { RedlineEdit } from '../redline/redline';
import { downloadBlob, stripPdfExt } from './appHelpers';

export interface SideLetterSignerDraft {
  name: string;
  title: string;
}

export interface UseSideLetterApi {
  signerDraft: SideLetterSignerDraft;
  setSignerDraft: (draft: SideLetterSignerDraft) => void;
  /**
   * Render the side-letter HTML using the current signer draft. `sectionFor`
   * lets callers map paragraph indices to section labels — falls back to
   * `Page N, ¶ M` inside `buildSideLetterHtml`.
   */
  buildHtml: (input: {
    leaseName: string;
    edits: RedlineEdit[];
    sectionFor?: (paragraphIndex: number) => string | undefined;
  }) => string;
  /**
   * Open the rendered side-letter in a popup window. If the browser blocks
   * the popup we fall back to triggering a file download instead — keeps
   * the UI affordance discoverable.
   */
  preview: (input: {
    leaseName: string;
    edits: RedlineEdit[];
    sectionFor?: (paragraphIndex: number) => string | undefined;
  }) => void;
  /** Download the rendered side-letter HTML as a file. */
  download: (input: {
    leaseName: string;
    edits: RedlineEdit[];
    sectionFor?: (paragraphIndex: number) => string | undefined;
  }) => void;
}

function trimmedSigner(draft: SideLetterSignerDraft): SideLetterSigner | undefined {
  if (draft.name.trim() === '') return undefined;
  const out: SideLetterSigner = { name: draft.name.trim() };
  const title = draft.title.trim();
  if (title !== '') out.title = title;
  return out;
}

/**
 * Owns the side-letter signer draft and exposes a single render helper. The
 * preview / download decision lives in App.tsx (popup vs file download is a
 * UI concern, not a hook concern).
 */
export function useSideLetter(): UseSideLetterApi {
  const [signerDraft, setSignerDraft] = useState<SideLetterSignerDraft>({
    name: '',
    title: '',
  });

  const buildHtml = useCallback<UseSideLetterApi['buildHtml']>(
    (input) => {
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

  const download = useCallback<UseSideLetterApi['download']>(
    (input) => {
      const html = buildHtml(input);
      downloadBlob(
        html,
        'text/html',
        `${stripPdfExt(input.leaseName)}-side-letter.html`,
      );
    },
    [buildHtml],
  );

  const preview = useCallback<UseSideLetterApi['preview']>(
    (input) => {
      const html = buildHtml(input);
      const win = window.open('', '_blank', 'noopener,noreferrer');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        download(input);
      }
    },
    [buildHtml, download],
  );

  return { signerDraft, setSignerDraft, buildHtml, preview, download };
}
