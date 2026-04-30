import { RedlinePanel } from './RedlinePanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { SideLetterPanel } from './SideLetterPanel';
import { Button } from './system/Button';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
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
  /** Findings with suggested edits — used by the apply-all bulk action. */
  findings: Finding[];
  suggestedTextByRuleId: Record<string, string> | undefined;
  sectionForParagraph: (paragraphIndex: number) => string | undefined;
  safeAudit: (input: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
}

export function AppRedlinePane({
  doc,
  leaseName,
  redline,
  versionHistory,
  sideLetter,
  findings,
  suggestedTextByRuleId,
  sectionForParagraph,
  safeAudit,
}: AppRedlinePaneProps): JSX.Element {
  const editCount = redline.redlineEdits.length;
  const editedParagraphIndices = new Set(redline.redlineEdits.map((e) => e.paragraphIndex));
  // "Apply all" candidates: every finding that has a suggested text and
  // whose paragraph has no redline edit yet. Idempotent — re-clicking
  // applies nothing additional.
  const applyableFindings = suggestedTextByRuleId
    ? findings.filter((f) => {
        const t = suggestedTextByRuleId[f.ruleId];
        return (
          typeof t === 'string' && t.length > 0 && !editedParagraphIndices.has(f.paragraphIndex)
        );
      })
    : [];
  const applyableCount = applyableFindings.length;
  return (
    <>
      <header
        aria-label="redline header"
        className="px-4 pt-5 pb-4 border-b border-rule flex flex-wrap items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <p className="text-mono uppercase tracking-[0.08em] text-fg-faint mb-2">
            Redline · counter-proposal
          </p>
          <h2 className="font-serif text-[24px] font-semibold leading-tight text-fg m-0">
            {editCount === 0
              ? 'No edits yet'
              : `${editCount} paragraph${editCount === 1 ? '' : 's'} edited`}
          </h2>
          <p className="font-serif italic text-fg-muted mt-1.5 max-w-[60ch]">
            {editCount === 0
              ? 'Start by editing any paragraph below — your changes will export as a redline document.'
              : 'Original on the left, what you’d ask for on the right. Export as HTML or paste into your reply.'}
          </p>
        </div>
        <div
          role="group"
          aria-label="redline bulk actions"
          className="flex items-center gap-2 shrink-0"
        >
          <Button
            type="button"
            variant="subtle"
            size="sm"
            disabled={applyableCount === 0}
            aria-label={
              applyableCount === 0
                ? 'apply all suggestions (none available)'
                : `apply all ${applyableCount} suggestions`
            }
            onClick={() => {
              for (const f of applyableFindings) {
                const text = suggestedTextByRuleId?.[f.ruleId];
                if (!text) continue;
                void redline.applySuggestion({
                  finding: f,
                  paragraphIndex: f.paragraphIndex,
                  suggestedText: text,
                  doc,
                });
              }
            }}
          >
            {applyableCount === 0 ? 'Apply all' : `Apply all (${applyableCount})`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={editCount === 0}
            aria-label={
              editCount === 0 ? 'clear all edits (none to clear)' : `clear all ${editCount} edits`
            }
            onClick={() => {
              if (editCount === 0) return;
              if (
                typeof window !== 'undefined' &&
                !window.confirm(`Clear all ${editCount} redline edits?`)
              ) {
                return;
              }
              void redline.replaceAll([]);
            }}
          >
            Clear all
          </Button>
        </div>
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
