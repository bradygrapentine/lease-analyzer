import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 9 Part C — component does not yet exist; failing import is the red
// signal. The implementer creates `app/src/ui/DeltaPanel.tsx` exporting
// `DeltaPanel` with this prop shape:
//
//   interface DeltaPanelProps {
//     versions: { id: string; label: string }[];   // history rows
//     onGenerate: (input: {
//       baseVersionId: string;
//       targetVersionId: string;
//       passphrase: string;
//     }) => Promise<Uint8Array>;                   // .lgdelta bytes
//   }
import { DeltaPanel } from './DeltaPanel';

const versions = [
  { id: 'v1', label: 'Version 1' },
  { id: 'v2', label: 'Version 2' },
];

describe('DeltaPanel', () => {
  it('renders the history rows and disables generate until base + target are picked', () => {
    render(<DeltaPanel versions={versions} onGenerate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /generate|export/i })).toBeDisabled();
  });

  it('happy path: pick base + target + passphrase invokes onGenerate with those ids', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn(async () => new Uint8Array([1]));
    render(<DeltaPanel versions={versions} onGenerate={onGenerate} />);
    await user.selectOptions(screen.getByLabelText(/base/i), 'v1');
    await user.selectOptions(screen.getByLabelText(/target/i), 'v2');
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /generate|export/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0]?.[0]?.baseVersionId).toBe('v1');
    expect(onGenerate.mock.calls[0]?.[0]?.targetVersionId).toBe('v2');
  });
});
