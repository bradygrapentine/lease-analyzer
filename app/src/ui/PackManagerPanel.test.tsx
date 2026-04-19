import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackManagerPanel } from './PackManagerPanel';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from '../rules/packSchema';

function pack(id: string, over: Partial<RulePackFile> = {}): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id,
    name: `Pack ${id}`,
    version: '1.0.0',
    description: `Pack ${id} description`,
    rules: [
      {
        id: `${id}-r1`,
        severity: 'medium',
        category: 'fees',
        title: 'r1',
        explanation: 'x',
        citation: null,
        match: { type: 'regex', pattern: 'x', flags: 'i' },
      },
    ],
    ...over,
  };
}

describe('PackManagerPanel', () => {
  it('renders the built-in pack row as (built-in) and is not toggleable', () => {
    render(
      <PackManagerPanel
        builtInName="LeaseGuard v1"
        installed={[]}
        enabled={new Set()}
        onImport={async () => {}}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/LeaseGuard v1/)).toBeInTheDocument();
    expect(screen.getByText(/\(built-in\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /enable leaseguard v1/i }),
    ).not.toBeInTheDocument();
  });

  it('renders one row per installed pack with an enable/disable toggle', () => {
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[pack('p1'), pack('p2')]}
        enabled={new Set(['p1'])}
        onImport={async () => {}}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    const p1 = screen.getByRole('checkbox', { name: /enable pack p1/i });
    const p2 = screen.getByRole('checkbox', { name: /enable pack p2/i });
    expect(p1).toBeChecked();
    expect(p2).not.toBeChecked();
  });

  it('fires onToggle(id, bool) when a toggle is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[pack('p1')]}
        enabled={new Set()}
        onImport={async () => {}}
        onToggle={onToggle}
        onDelete={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /enable pack p1/i }));
    expect(onToggle).toHaveBeenCalledWith('p1', true);
  });

  it('fires onDelete when the delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[pack('p1')]}
        enabled={new Set()}
        onImport={async () => {}}
        onToggle={() => {}}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete pack p1/i }));
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('calls onImport with a selected file', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[]}
        enabled={new Set()}
        onImport={onImport}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    const file = new File(['{"schema":"leaseguard.rulepack.v1"}'], 'example.lgpack.json', {
      type: 'application/json',
    });
    await userEvent.upload(input, file);
    expect(onImport).toHaveBeenCalledTimes(1);
    const [passed] = onImport.mock.calls[0]!;
    expect(passed).toBeInstanceOf(File);
    expect((passed as File).name).toBe('example.lgpack.json');
  });

  it('empty-state when no installed packs are present still shows the built-in row and the importer', () => {
    render(
      <PackManagerPanel
        builtInName="LG built-in"
        installed={[]}
        enabled={new Set()}
        onImport={async () => {}}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/LG built-in/)).toBeInTheDocument();
    expect(screen.getByText(/no additional packs installed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/import rule pack/i)).toBeInTheDocument();
  });

  it('does not call onImport when the user cancels (no file selected)', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[]}
        enabled={new Set()}
        onImport={onImport}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    // Simulate a change event with no files.
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('surfaces import errors via a status message', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('bad schema'));
    render(
      <PackManagerPanel
        builtInName="Built-in"
        installed={[]}
        enabled={new Set()}
        onImport={onImport}
        onToggle={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    const file = new File(['junk'], 'bad.lgpack.json', { type: 'application/json' });
    await userEvent.upload(input, file);
    expect(await screen.findByRole('status')).toHaveTextContent(/bad schema/);
  });
});
