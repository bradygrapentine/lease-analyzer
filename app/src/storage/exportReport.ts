import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import type { BaselineDeviation } from '../rules/packBaseline';
import { signPayload } from '../security/signingKeys';

export interface ExportInput {
  name: string;
  doc: LeaseDocument;
  findings: Finding[];
  /** Optional SHA-256 hex of the original PDF bytes. */
  inputHash?: string | null;
  /**
   * Wave 8 Part B — diff-vs-verified baseline deviations for the rule
   * pack used in this analysis. Optional + additive: if omitted the
   * exported envelope simply carries `deviations: []`.
   */
  deviations?: BaselineDeviation[];
}

export const EXPORT_SCHEMA = 'leaseguard.findings.v1';

export interface SignatureBlock {
  publicKey: string;
  signature: string;
  signedAt: string;
}

export function exportFindingsJson(input: ExportInput): string {
  const payload = {
    schema: EXPORT_SCHEMA,
    lease: {
      name: input.name,
      pageCount: input.doc.pages.length,
      paragraphCount: input.doc.paragraphs.length,
      sectionCount: input.doc.sections.length,
    },
    inputHash: input.inputHash ?? null,
    rulePackVersion: input.findings[0]?.rulePackVersion ?? null,
    findings: input.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      title: f.title,
      explanation: f.explanation,
      citation: f.citation,
      page: f.page,
      snippet: f.snippet,
      span: f.span,
      confidence: Number(f.confidence.toFixed(2)),
      negated: f.negated,
    })),
    deviations: (input.deviations ?? []).map((d) => ({
      id: d.id,
      baselineFingerprint: d.baselineFingerprint,
      currentFingerprint: d.currentFingerprint,
      deviates: d.deviates,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Takes an unsigned JSON export string and returns a new JSON string with a
 * `signature` field appended. The signed bytes are the unsigned payload
 * exactly as produced by `exportFindingsJson` (no re-serialization twists),
 * so verification just re-runs `JSON.stringify` on the signed payload with
 * `signature` removed.
 */
export async function signExport(json: string, passphrase: string): Promise<string> {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if ('signature' in parsed) {
    throw new Error('Export is already signed.');
  }
  // Canonicalize to the exact same serialization we signed. We re-stringify
  // with the same 2-space indent to keep verification straightforward.
  const canonical = JSON.stringify(parsed, null, 2);
  const bytes = new TextEncoder().encode(canonical);
  const { signature, publicKey } = await signPayload(bytes, passphrase);
  const signedAt = new Date().toISOString();
  const signatureBlock: SignatureBlock = { publicKey, signature, signedAt };
  const signed = { ...parsed, signature: signatureBlock };
  return JSON.stringify(signed, null, 2);
}

/**
 * Verifies a signed export. Returns `true` iff the signature is valid for the
 * payload as canonically serialized with 2-space indent. Returns `false` on
 * any verification failure; throws only if the JSON is syntactically bad.
 */
export async function verifySignedExport(json: string): Promise<boolean> {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const sig = parsed['signature'] as SignatureBlock | undefined;
  if (!sig || typeof sig.signature !== 'string' || typeof sig.publicKey !== 'string') {
    return false;
  }
  const rest: Record<string, unknown> = {};
  for (const k of Object.keys(parsed)) {
    if (k !== 'signature') rest[k] = parsed[k];
  }
  const canonical = JSON.stringify(rest, null, 2);
  const payloadBytes = new TextEncoder().encode(canonical);
  try {
    const pubRaw = Uint8Array.from(atob(sig.publicKey), (c) => c.charCodeAt(0));
    const pubKey = await crypto.subtle.importKey(
      'raw',
      pubRaw as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sig.signature), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify(
      'Ed25519',
      pubKey,
      sigBytes as BufferSource,
      payloadBytes as BufferSource,
    );
  } catch {
    return false;
  }
}
