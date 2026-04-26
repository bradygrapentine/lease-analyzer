import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = { title: 'System/Tokens' };
export default meta;
type Story = StoryObj;

const COLORS = [
  ['paper', 'fg'], ['paper-raised', 'fg'], ['paper-sunken', 'fg'],
  ['fg', 'paper'], ['fg-body', 'paper'], ['fg-muted', 'paper'], ['fg-faint', 'paper'],
  ['rule', 'fg'], ['rule-subtle', 'fg'],
  ['ink', 'paper'],
  ['severity-high', 'paper'], ['severity-medium', 'paper'],
  ['severity-low', 'paper'], ['severity-info', 'paper'],
  ['positive', 'paper'], ['negative', 'paper'],
] as const;

export const Tokens: Story = {
  render: () => (
    <div className="p-8 bg-paper min-h-screen">
      <h2 className="text-display font-display text-fg mb-6">Design tokens</h2>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Color</h3>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {COLORS.map(([bg, fg]) => (
          <div key={bg}
               className={`bg-${bg} text-${fg} border border-rule p-3 rounded-sm`}>
            <div className="text-body font-sans">--color-{bg}</div>
          </div>
        ))}
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Type</h3>
      <div className="space-y-3 mb-8">
        <div className="text-display font-display text-fg">Display 28/32 — serif</div>
        <div className="text-heading uppercase font-sans text-fg-muted">Heading 15/22 — sans uppercase</div>
        <div className="text-body font-sans text-fg-body">Body 14/22 — sans</div>
        <div className="text-small font-sans text-fg-muted">Small 12.5/18 — sans</div>
        <div className="text-mono font-mono text-fg-muted">Mono 12/18 — JetBrains Mono</div>
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Spacing</h3>
      <div className="flex items-end gap-2 mb-8">
        {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div className={`w-${n} h-${n} bg-ink rounded-sm`} />
            <div className="text-small text-fg-muted">{n}</div>
          </div>
        ))}
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Radius</h3>
      <div className="flex gap-3">
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded-none" />
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded-sm" />
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded" />
      </div>
    </div>
  ),
};
