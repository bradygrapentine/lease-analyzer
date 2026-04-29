import { useCallback, useEffect, useState } from 'react';
import { createSigningKey, exportPublicKey } from '../security/signingKeys';
import { signExport, exportFindingsJson } from '../storage/exportReport';
import { sha256Hex } from '../security/inputHash';
import { computeShortFingerprintFromBase64 } from '../security/fingerprint';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import { downloadBlob, stripPdfExt } from './appHelpers';

/**
 * Discriminated status returned by `exportKeyToClipboard`. `copied` on
 * success; `denied` when the API is missing (insecure context) or the
 * platform rejected the write (permission, focus). `reason` is the bare
 * `Error.message` from the rejection, or a synthetic message when the API
 * is unavailable.
 */
export type ClipboardWriteStatus = { status: 'copied' } | { status: 'denied'; reason: string };

export interface UseSigningKeyApi {
  /** Base64 public key, or null if no key has been generated yet. */
  publicKey: string | null;
  /** Generate a new signing key, encrypted with `passphrase`. */
  createKey: (passphrase: string) => Promise<void>;
  /**
   * Best-effort copy of the base64 public key to the clipboard. CSP / focus
   * policies may block; on failure we surface the reason so callers can render
   * a visible status. The UI fallback (the key shown inline) is unchanged.
   */
  exportKeyToClipboard: (publicKey: string) => Promise<ClipboardWriteStatus>;
  /**
   * Sign + download a findings JSON. Throws on bad passphrase or signing
   * failure so callers can surface the message via their error channel.
   */
  signAndDownloadFindings: (input: {
    fileName: string;
    doc: LeaseDocument;
    findings: Finding[];
    bytes: Uint8Array | null;
    passphrase: string;
  }) => Promise<{
    fileName: string;
    /** SHA-256 hex of the original PDF bytes, or null when bytes are absent. */
    inputHash: string | null;
    /**
     * Short fingerprint (8 hex chars, SHA-256(rawPublicKey)[0:4]) of the
     * Ed25519 public key used to sign. Null when the public key cannot be
     * resolved at sign time. Honest-not-coerced.
     */
    signingKeyId: string | null;
  }>;
  /** Re-read the public key from storage (used after rotation). */
  refresh: () => Promise<void>;
}

/**
 * Owns the user's Ed25519 signing key state. Storage is the leaseguard-signing
 * IDB database; the public-key cache is purely a UI mirror.
 */
export function useSigningKey(): UseSigningKeyApi {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setPublicKey(await exportPublicKey());
  }, []);

  const createKey = useCallback(
    async (passphrase: string): Promise<void> => {
      await createSigningKey(passphrase);
      await refresh();
    },
    [refresh],
  );

  const exportKeyToClipboard = useCallback(async (pk: string): Promise<ClipboardWriteStatus> => {
    const nav = globalThis.navigator as
      | { clipboard?: { writeText?: (s: string) => Promise<void> } }
      | undefined;
    const writeText = nav?.clipboard?.writeText;
    if (typeof writeText !== 'function') {
      return {
        status: 'denied',
        reason: 'Clipboard API unavailable in this context.',
      };
    }
    try {
      await writeText.call(nav!.clipboard, pk);
      return { status: 'copied' };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { status: 'denied', reason };
    }
  }, []);

  const signAndDownloadFindings = useCallback<UseSigningKeyApi['signAndDownloadFindings']>(
    async ({ fileName, doc, findings, bytes, passphrase }) => {
      const inputHash = bytes ? await sha256Hex(bytes) : null;
      const unsigned = exportFindingsJson({ name: fileName, doc, findings, inputHash });
      const signed = await signExport(unsigned, passphrase);
      // Resolve the signing key fingerprint from the public key on file. If the
      // public key cannot be resolved, surface null rather than coercing.
      let signingKeyId: string | null = null;
      const pk = await exportPublicKey();
      if (pk) {
        try {
          signingKeyId = await computeShortFingerprintFromBase64(pk);
        } catch {
          signingKeyId = null;
        }
      }
      const downloadName = `${stripPdfExt(fileName)}-findings.signed.json`;
      downloadBlob(signed, 'application/json', downloadName);
      return { fileName: downloadName, inputHash, signingKeyId };
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    publicKey,
    createKey,
    exportKeyToClipboard,
    signAndDownloadFindings,
    refresh,
  };
}
