import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetPacksDbForTests,
  deleteInstalledPack,
  getPackEnabled,
  getSelectedJurisdictions,
  getSeverityOverrides,
  listInstalledPacks,
  openPacksDb,
  saveInstalledPack,
  setPackEnabled,
  setSelectedJurisdictions,
  setSeverityOverride,
} from './packStorage';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from './packSchema';

function pack(id: string, overrides: Partial<RulePackFile> = {}): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id,
    name: `Pack ${id}`,
    version: '1.0.0',
    description: `Test pack ${id}`,
    rules: [
      {
        id: `${id}-r1`,
        severity: 'low',
        category: 'general',
        title: 'Rule',
        explanation: 'Explanation',
        citation: null,
        match: { type: 'regex', pattern: 'x', flags: 'i' },
      },
    ],
    ...overrides,
  };
}

async function wipe(): Promise<void> {
  const db = await openPacksDb();
  db.close();
  _resetPacksDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard-packs');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('packStorage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves and lists an installed pack', async () => {
    await saveInstalledPack(pack('foo'));
    const list = await listInstalledPacks();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('foo');
  });

  it('returns enabled=false by default and can be toggled', async () => {
    await saveInstalledPack(pack('foo'));
    expect(await getPackEnabled('foo')).toBe(false);
    await setPackEnabled('foo', true);
    expect(await getPackEnabled('foo')).toBe(true);
    await setPackEnabled('foo', false);
    expect(await getPackEnabled('foo')).toBe(false);
  });

  it('overwrites when saving a pack with the same id (upgrade)', async () => {
    await saveInstalledPack(pack('foo', { version: '1.0.0' }));
    await saveInstalledPack(pack('foo', { version: '2.0.0' }));
    const list = await listInstalledPacks();
    expect(list).toHaveLength(1);
    expect(list[0]?.version).toBe('2.0.0');
  });

  it('deleteInstalledPack removes both the pack and its enabled flag', async () => {
    await saveInstalledPack(pack('foo'));
    await setPackEnabled('foo', true);
    await deleteInstalledPack('foo');
    expect(await listInstalledPacks()).toEqual([]);
    expect(await getPackEnabled('foo')).toBe(false);
  });

  it('lists multiple installed packs deterministically', async () => {
    await saveInstalledPack(pack('beta'));
    await saveInstalledPack(pack('alpha'));
    const list = await listInstalledPacks();
    expect(list.map((p) => p.id).sort()).toEqual(['alpha', 'beta']);
  });

  it('uses its own IndexedDB database distinct from the leases one', async () => {
    await saveInstalledPack(pack('foo'));
    // Lease DB "leaseguard" must be untouched.
    const names = await new Promise<string[]>((resolve) => {
      const req = indexedDB.databases?.();
      if (!req) return resolve([]);
      Promise.resolve(req).then((infos) => resolve(infos.map((i) => i.name ?? '')));
    });
    if (names.length > 0) {
      expect(names).toContain('leaseguard-packs');
      expect(names).not.toContain('leaseguard');
    }
  });

  it('selectedJurisdictions defaults to an empty array', async () => {
    expect(await getSelectedJurisdictions()).toEqual([]);
  });

  it('setSelectedJurisdictions persists, round-trips, and de-dupes', async () => {
    await setSelectedJurisdictions(['US-CA', 'US-CA', 'US-NY']);
    expect(await getSelectedJurisdictions()).toEqual(['US-CA', 'US-NY']);
  });

  it('setSelectedJurisdictions([]) clears the selection', async () => {
    await setSelectedJurisdictions(['US-CA']);
    await setSelectedJurisdictions([]);
    expect(await getSelectedJurisdictions()).toEqual([]);
  });

  it('severityOverrides defaults to {} ', async () => {
    expect(await getSeverityOverrides()).toEqual({});
  });

  it('setSeverityOverride writes a single entry and survives re-read', async () => {
    await setSeverityOverride('rule-a', 'high');
    expect(await getSeverityOverrides()).toEqual({ 'rule-a': 'high' });
  });

  it('setSeverityOverride merges multiple entries', async () => {
    await setSeverityOverride('rule-a', 'high');
    await setSeverityOverride('rule-b', 'info');
    expect(await getSeverityOverrides()).toEqual({
      'rule-a': 'high',
      'rule-b': 'info',
    });
  });

  it('setSeverityOverride(ruleId, null) removes the entry', async () => {
    await setSeverityOverride('rule-a', 'high');
    await setSeverityOverride('rule-b', 'info');
    await setSeverityOverride('rule-a', null);
    expect(await getSeverityOverrides()).toEqual({ 'rule-b': 'info' });
  });

  it('setSeverityOverride(ruleId, null) on an already-missing id is a no-op', async () => {
    await setSeverityOverride('rule-a', null);
    expect(await getSeverityOverrides()).toEqual({});
  });

  it('severity overrides survive across db handle resets (persistence)', async () => {
    await setSeverityOverride('rule-a', 'medium');
    const db = await openPacksDb();
    db.close();
    _resetPacksDbForTests();
    expect(await getSeverityOverrides()).toEqual({ 'rule-a': 'medium' });
  });
});
