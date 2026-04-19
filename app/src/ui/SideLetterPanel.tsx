import type { RedlineEdit } from '../redline/redline';

export interface SideLetterPanelProps {
  leaseName: string;
  edits: RedlineEdit[];
  signerDraft?: { name: string; title: string };
  onSignerChange: (signer: { name: string; title: string }) => void;
  onPreview: () => void;
  onDownload: () => void;
}

/**
 * Controlled form for composing a side-letter. The actual HTML/text
 * rendering (via `buildSideLetterHtml`) and the preview window / file
 * download side-effects live in the caller so this panel stays pure.
 */
export function SideLetterPanel({
  leaseName,
  edits,
  signerDraft,
  onSignerChange,
  onPreview,
  onDownload,
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
        <button
          type="button"
          aria-label="generate side letter preview"
          onClick={onPreview}
        >
          Generate preview
        </button>
        <button
          type="button"
          aria-label="download side letter"
          onClick={onDownload}
        >
          Download
        </button>
      </div>
    </section>
  );
}
