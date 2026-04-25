// Discover which tesseract OCR languages have been provisioned in
// `public/tesseract/`. The CSP contract is `default-src 'self'`, so the
// only allowed fetch here is the same-origin static manifest at
// `/tesseract/languages.json`. Any malformed / missing manifest yields
// an empty array, which the picker UI treats as "hide the picker".

export interface OcrLanguage {
  code: string;
  label: string;
}

interface ManifestShape {
  schema: string;
  languages: OcrLanguage[];
}

const MANIFEST_PATH = '/tesseract/languages.json';
const SCHEMA_ID = 'leaseguard.tesseract.languages.v1';

function isManifest(value: unknown): value is ManifestShape {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v['schema'] !== SCHEMA_ID) return false;
  if (!Array.isArray(v['languages'])) return false;
  for (const entry of v['languages']) {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as Record<string, unknown>;
    if (typeof e['code'] !== 'string' || e['code'].length === 0) return false;
    if (typeof e['label'] !== 'string' || e['label'].length === 0) return false;
  }
  return true;
}

export async function discoverOcrLanguages(
  fetchImpl: typeof fetch = fetch,
): Promise<OcrLanguage[]> {
  let res: Response;
  try {
    res = await fetchImpl(MANIFEST_PATH);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return [];
  }
  if (!isManifest(parsed)) return [];
  // Defensive copy: the picker mutates nothing but we do not want the
  // caller to be able to mutate the cached parsed payload either.
  return parsed.languages.map((l) => ({ code: l.code, label: l.label }));
}
