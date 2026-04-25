import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetStandardsDbForTests,
  deleteStandard,
  listStandards,
  promoteToStandard,
} from './standardSuite';
import {
  AUDIT_DB_NAME,
  listAuditEntries,
  _resetAuditDbForTests,
} from '../audit/auditLog';

const STANDARDS_DB_NAME = 'leaseguard-standards';

async function wipeStandards(): Promise<void> {
  _resetStandardsDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(STANDARDS_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

async function wipeAudit(): Promise<void> {
  _resetAuditDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(AUDIT_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('standardSuite', () => {
  beforeEach(async () => {
    await wipeStandards();
    await wipeAudit();
  });

  it('listStandards is empty on a fresh db', async () => {
    expect(await listStandards()).toEqual([]);
  });

  it('promoteToStandard adds a row that listStandards returns', async () => {
    const created = await promoteToStandard({
      name: 'Auto-renewal standard',
      sourceLeaseId: 'L1',
      sourceParagraphIndex: 2,
      normalizedText: 'auto renewal clause text',
    });
    expect(created.id).toMatch(/.+/);
    expect(created.createdAt).toBeGreaterThan(0);
    const list = await listStandards();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Auto-renewal standard');
    expect(list[0]?.sourceLeaseId).toBe('L1');
    expect(list[0]?.sourceParagraphIndex).toBe(2);
  });

  it('deleteStandard removes the matching row without orphaning others', async () => {
    const a = await promoteToStandard({
      name: 'A',
      sourceLeaseId: 'L1',
      sourceParagraphIndex: 0,
      normalizedText: 'a',
    });
    const b = await promoteToStandard({
      name: 'B',
      sourceLeaseId: 'L2',
      sourceParagraphIndex: 1,
      normalizedText: 'b',
    });
    await deleteStandard(a.id);
    const list = await listStandards();
    expect(list.map((s) => s.id)).toEqual([b.id]);
  });

  it('promoteToStandard writes a "standard-promote" audit entry via safeAudit/appendAuditEntry', async () => {
    await promoteToStandard({
      name: 'A',
      sourceLeaseId: 'L1',
      sourceParagraphIndex: 0,
      normalizedText: 'a',
    });
    const entries = await listAuditEntries();
    const promote = entries.find((e) => e.kind === 'standard-promote');
    expect(promote).toBeDefined();
  });

  it('deleteStandard writes a "standard-delete" audit entry', async () => {
    const a = await promoteToStandard({
      name: 'A',
      sourceLeaseId: 'L1',
      sourceParagraphIndex: 0,
      normalizedText: 'a',
    });
    await deleteStandard(a.id);
    const entries = await listAuditEntries();
    const del = entries.find((e) => e.kind === 'standard-delete');
    expect(del).toBeDefined();
  });

  it('_resetStandardsDbForTests allows a fresh open after deleteDatabase', async () => {
    await promoteToStandard({
      name: 'A',
      sourceLeaseId: 'L1',
      sourceParagraphIndex: 0,
      normalizedText: 'a',
    });
    await wipeStandards();
    expect(await listStandards()).toEqual([]);
  });
});
