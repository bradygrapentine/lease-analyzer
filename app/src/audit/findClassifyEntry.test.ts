import { describe, it, expect } from 'vitest';
import { findClassifyEntry } from './findClassifyEntry';
import type { AuditEntry } from './auditLog';

// C.1 verification: AuditEntry has no `id` field. The canonical reference is
// `entryHash` (SHA-256 hex of the entry's content). We surface entryHash here.
// The helper uses `entryHash` as the stable identifier.
function entry(
  kind: string,
  payload: Record<string, unknown>,
  entryHash = 'x',
): AuditEntry {
  return {
    kind,
    payload,
    entryHash,
    seq: 1,
    timestamp: '2024-01-01T00:00:00.000Z',
    prevHash: '',
  } as AuditEntry;
}

describe('findClassifyEntry', () => {
  it('returns null on empty chain', () => {
    expect(findClassifyEntry([], 'rule.x', 3)).toBeNull();
  });

  it('returns null when no entry matches (ruleId or paragraphIndex)', () => {
    const wrongRule = [entry('llm-classify', { ruleId: 'rule.y', paragraphIndex: 3 })];
    expect(findClassifyEntry(wrongRule, 'rule.x', 3)).toBeNull();
    const wrongPara = [entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 4 })];
    expect(findClassifyEntry(wrongPara, 'rule.x', 3)).toBeNull();
  });

  it('returns the matching entry when one exists', () => {
    const match = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'a1b2c3d4e5f6');
    const chain = [entry('other', {}), match];
    expect(findClassifyEntry(chain, 'rule.x', 3)).toBe(match);
  });

  it('returns the most recent when multiple match', () => {
    const old = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'oldhash12345');
    const recent = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'recenthash12');
    const chain = [old, entry('other', {}), recent];
    expect(findClassifyEntry(chain, 'rule.x', 3)?.entryHash).toBe('recenthash12');
  });

  it('ignores entries with non-llm-classify kinds (incl. hybrid-feedback)', () => {
    const chain = [
      entry('hybrid-feedback', { ruleId: 'rule.x', paragraphIndex: 3 }),
      entry('parse-lease', { ruleId: 'rule.x', paragraphIndex: 3 }),
    ];
    expect(findClassifyEntry(chain, 'rule.x', 3)).toBeNull();
  });
});
