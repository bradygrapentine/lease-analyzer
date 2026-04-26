import { useState } from 'react';
import type { Finding } from '../rules/types';
import { Section } from './system/Section';
import { Button } from './system/Button';

// Aria/data inventory (preserved verbatim):
//   aria-label="workflow" (aside — now Section)
//   role="group" + aria-label="workflow actions" (div)
//   role="status" + aria-live="polite" (p)

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
    <Section label="workflow" className="workflow-panel space-y-3">
      <h3 className="text-heading uppercase text-fg-muted mb-1">Workflow</h3>
      <p className="lease-name text-body text-fg-body">
        <strong>{leaseName}</strong> · {findings.length} finding
        {findings.length === 1 ? '' : 's'}
      </p>
      <div className="actions flex flex-wrap gap-2" role="group" aria-label="workflow actions">
        <Button type="button" variant="subtle" size="sm" onClick={onBuildIcs}>
          Download .ics
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={handleCopy}
          disabled={copyStatus === 'copying'}
        >
          Copy summary
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onDownloadHandoff}>
          Download handoff ZIP
        </Button>
      </div>
      <p className="status text-small text-fg-muted" role="status" aria-live="polite">
        {copyStatus === 'copied' && 'Copied!'}
        {copyStatus === 'copying' && 'Copying…'}
        {copyStatus === 'failed' && 'Copy failed.'}
      </p>
    </Section>
  );
}
