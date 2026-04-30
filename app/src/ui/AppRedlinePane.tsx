import { RedlinePanel } from './RedlinePanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { SideLetterPanel } from './SideLetterPanel';
import type { LeaseDocument } from '../parser/types';
import type { UseRedlineStateApi } from '../App/useRedlineState';
import type { UseVersionHistoryApi } from '../App/useVersionHistory';
import type { UseSideLetterApi } from '../App/useSideLetter';
import { downloadBlob, stripPdfExt } from '../App/appHelpers';

interface AppRedlinePaneProps {
  doc: LeaseDocument;
  leaseName: string;
  redline: UseRedlineStateApi;
  versionHistory: UseVersionHistoryApi;
  sideLetter: UseSideLetterApi;
  sectionForParagraph: (paragraphIndex: number) => string | undefined;
  safeAudit: (input: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
}

export function AppRedlinePane({
  doc,
  leaseName,
  redline,
  versionHistory,
  sideLetter,
  sectionForParagraph,
  safeAudit,
}: AppRedlinePaneProps): JSX.Element {
  const editCount = redline.redlineEdits.length;
  return (
    <>
      <header aria-label="redline header" className="px-4 pt-4 pb-3 border-b border-rule">
        <p className="text-mono uppercase text-fg-muted mb-1">Redline · counter-proposal</p>
        <p className="text-heading text-fg-body">
          {editCount === 0
            ? 'No edits yet — start by editing a paragraph below.'
            : `${editCount} paragraph${editCount === 1 ? '' : 's'} edited`}
        </p>
        <p className="text-small text-fg-muted italic mt-1">
          Original on the left, what you&rsquo;d ask for on the right. Export as HTML or paste into
          your reply.
        </p>
      </header>
      <RedlinePanel
        doc={doc}
        edits={redline.redlineEdits}
        onEditParagraph={(pIdx, after) => {
          const before = doc.paragraphs[pIdx]?.text ?? '';
          void redline.editParagraph({ paragraphIndex: pIdx, before, after });
        }}
        onDeleteEdit={(pIdx) => void redline.deleteParagraphEdit(pIdx)}
        onExportHtml={() => {
          downloadBlob(
            redline.buildHtml({ leaseName, doc }),
            'text/html',
            `${stripPdfExt(leaseName)}-redline.html`,
          );
        }}
      />
      <details>
        <summary>Version history</summary>
        <VersionHistoryPanel
          versions={versionHistory.versions}
          currentEditCount={redline.redlineEdits.length}
          onCreateVersion={(label, note) => void versionHistory.createVersion(label, note)}
          onRestoreVersion={(vId) => void versionHistory.restoreVersion(vId, redline.replaceAll)}
          onDeleteVersion={(vId) => void versionHistory.removeVersion(vId)}
          onExportVersion={(vId) => {
            void versionHistory.exportVersion(vId, { leaseName, doc });
          }}
        />
      </details>
      <SideLetterPanel
        leaseName={leaseName}
        edits={redline.redlineEdits}
        signerDraft={sideLetter.signerDraft}
        previewHtml={sideLetter.previewHtml}
        onSignerChange={(s) => sideLetter.setSignerDraft(s)}
        onPreview={() => {
          sideLetter.preview({
            leaseName,
            edits: redline.redlineEdits,
            sectionFor: sectionForParagraph,
          });
        }}
        onClosePreview={() => sideLetter.clearPreview()}
        onDownload={() => {
          sideLetter.download({
            leaseName,
            edits: redline.redlineEdits,
            sectionFor: sectionForParagraph,
          });
          void safeAudit({
            kind: 'export',
            payload: { artifact: 'side-letter', format: 'html', leaseName },
          });
        }}
        onDownloadPdf={() => {
          void sideLetter
            .downloadPdf({
              leaseName,
              edits: redline.redlineEdits,
              sectionFor: sectionForParagraph,
            })
            .then(() =>
              safeAudit({
                kind: 'export',
                payload: { artifact: 'side-letter', format: 'pdf', leaseName },
              }),
            );
        }}
      />
    </>
  );
}
