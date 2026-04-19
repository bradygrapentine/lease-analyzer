import { useState } from 'react';
import type { Finding } from '../rules/types';

export interface WorkflowPanelProps {
  leaseName: string;
  findings: Finding[];
  onBuildIcs: () => void;
  onCopySummary: () => Promise<void>;
  onDownloadHandoff: () => void;
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'failed';

export function WorkflowPanel(props: WorkflowPanelProps): JSX.Element {
  const { leaseName, findings, onBuildIcs, onCopySummary, onDownloadHandoff } = props;
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  async function handleCopy(): Promise<void> {
    setCopyStatus('copying');
    try {
      await onCopySummary();
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <aside aria-label="workflow" className="workflow-panel">
      <h2>Workflow</h2>
      <p className="lease-name">
        <strong>{leaseName}</strong> · {findings.length} finding
        {findings.length === 1 ? '' : 's'}
      </p>
      <div className="actions" role="group" aria-label="workflow actions">
        <button type="button" onClick={onBuildIcs}>
          Download .ics
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyStatus === 'copying'}
        >
          Copy summary
        </button>
        <button type="button" onClick={onDownloadHandoff}>
          Download handoff ZIP
        </button>
      </div>
      <p className="status" role="status" aria-live="polite">
        {copyStatus === 'copied' && 'Copied!'}
        {copyStatus === 'copying' && 'Copying…'}
        {copyStatus === 'failed' && 'Copy failed.'}
      </p>
    </aside>
  );
}
