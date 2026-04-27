import type { RedlineEdit } from '../redline/redline';

export interface SideLetterPanelProps {
  leaseName: string;
  edits: RedlineEdit[];
  signerDraft?: { name: string; title: string };
  /** Rendered HTML preview to display in-panel; null hides the iframe. */
  previewHtml?: string | null;
  onSignerChange: (signer: { name: string; title: string }) => void;
  onPreview: () => void;
  onClosePreview?: () => void;
  onDownload: () => void;
  onDownloadPdf?: () => void;
}

/**
 * Controlled form for composing a side-letter. Rendering and download
 * side-effects live in the caller; the panel owns layout and the
 * in-panel iframe preview.
 */
export function SideLetterPanel({
  leaseName,
  edits,
  signerDraft,
  previewHtml,
  onSignerChange,
  onPreview,
  onClosePreview,
  onDownload,
  onDownloadPdf,
}: SideLetterPanelProps): JSX.Element {
  const name = signerDraft?.name ?? '';
  const title = signerDraft?.title ?? '';
  const uniqueEditCount = new Set(edits.map((e) => e.paragraphIndex)).size;

  return (
    <section aria-label="side letter">
      <h2>Side letter</h2>
      <p>
        For: <strong>{leaseName}</strong>
      </p>
      <p>
        {uniqueEditCount} proposed change{uniqueEditCount === 1 ? '' : 's'}
      </p>

      <form
        aria-label="signer"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label>
          Signer name
          <input
            type="text"
            aria-label="signer name"
            value={name}
            onChange={(e) => onSignerChange({ name: e.target.value, title })}
          />
        </label>
        <label>
          Signer title
          <input
            type="text"
            aria-label="signer title"
            value={title}
            onChange={(e) => onSignerChange({ name, title: e.target.value })}
          />
        </label>
      </form>

      <div className="side-letter-actions">
        <button type="button" aria-label="generate side letter preview" onClick={onPreview}>
          Generate preview
        </button>
        <button type="button" aria-label="download side letter html" onClick={onDownload}>
          Download HTML
        </button>
        {onDownloadPdf && (
          <button type="button" aria-label="download side letter pdf" onClick={onDownloadPdf}>
            Export PDF
          </button>
        )}
      </div>

      {previewHtml !== null && previewHtml !== undefined && (
        <div className="side-letter-preview" aria-label="side letter preview">
          <div className="side-letter-preview__header">
            <span>Preview</span>
            {onClosePreview && (
              <button type="button" aria-label="close side letter preview" onClick={onClosePreview}>
                Close
              </button>
            )}
          </div>
          <iframe
            title="side letter preview"
            srcDoc={previewHtml}
            sandbox=""
            style={{ width: '100%', height: '32rem', border: '1px solid var(--color-rule)' }}
          />
        </div>
      )}
    </section>
  );
}
