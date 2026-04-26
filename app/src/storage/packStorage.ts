/**
 * Wave 13 Part C — curated marketplace helpers.
 *
 * Read-only helpers for the curated-pack marketplace UI. The canonical
 * IndexedDB-backed pack store lives at `src/rules/packStorage.ts`; this
 * module is intentionally separate so the marketplace wire-up never
 * mutates persisted state and so the helper sits next to other UI-facing
 * storage adapters in `src/storage/`.
 *
 * `listCuratedPackUrls()` returns the set of same-origin paths the
 * marketplace can fetch. The list is currently derived from the curated
 * manifest at `/packs/curated/manifest.json` — keeping the logic here
 * means callers can stub the manifest loader for tests without hitting
 * `fetch` in the rest of the panel.
 */

import { loadCuratedManifest, type CuratedPackEntry } from '../rules/curatedPacks';

/**
 * Resolve the same-origin URLs for every curated pack advertised in the
 * shipped manifest. Returns `[]` on any load / parse failure so callers
 * can surface an empty marketplace state instead of throwing.
 *
 * Network policy: this helper only reads `/packs/curated/manifest.json`
 * (a same-origin static asset bundled into the PWA). It performs no
 * cross-origin requests and never writes to IndexedDB.
 */
export async function listCuratedPackUrls(): Promise<string[]> {
  try {
    const entries = await loadCuratedManifest();
    return entries.map((e: CuratedPackEntry) => e.path);
  } catch {
    return [];
  }
}
