import {
  BY_FINDING_AND_PACK_INDEX,
  openLeaseDb,
  type LeaseMetadata,
  type LeaseRecord,
} from './storage';

export interface ListLeasesFilter {
  /** Match an exact findingCount (e.g. 0 = "clean leases only"). */
  findingCount?: number;
  /** Match an exact rule-pack version string. */
  rulePackVersion?: string;
}

/**
 * Typed query helper backed by the v4 compound index `[findingCount,
 * rulePackVersion]`. Returns metadata only — `doc` and `findings`
 * are stripped so callers (e.g. the portfolio panel) don't pay the
 * cost of pulling lease bodies into memory just to render a row.
 *
 * - Both keys provided → IDBKeyRange.only on the compound key.
 * - Only `findingCount` → bounded range over [n, *].
 * - Only `rulePackVersion` → falls back to a getAll + filter, since
 *   compound indexes can't seek by the second key without the first.
 * - Neither → full getAll (matches `listLeases` semantics).
 */
export async function listLeasesFiltered(
  filter: ListLeasesFilter,
): Promise<LeaseMetadata[]> {
  const db = await openLeaseDb();
  const { findingCount, rulePackVersion } = filter;

  let records: LeaseRecord[];
  if (findingCount !== undefined && rulePackVersion !== undefined) {
    const idx = db.transaction('leases').store.index(BY_FINDING_AND_PACK_INDEX);
    records = await idx.getAll(IDBKeyRange.only([findingCount, rulePackVersion]));
  } else if (findingCount !== undefined) {
    const idx = db.transaction('leases').store.index(BY_FINDING_AND_PACK_INDEX);
    records = await idx.getAll(
      IDBKeyRange.bound([findingCount, ''], [findingCount, '￿']),
    );
  } else if (rulePackVersion !== undefined) {
    const all = await db.getAll('leases');
    records = all.filter((r) => r.rulePackVersion === rulePackVersion);
  } else {
    records = await db.getAll('leases');
  }

  return records
    .map(({ doc: _doc, findings: _findings, ...meta }) => meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}
