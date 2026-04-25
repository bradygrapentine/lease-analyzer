import { useCallback, useEffect, useState } from 'react';
import { createSigningKey, exportPublicKey } from '../security/signingKeys';
import { signExport, exportFindingsJson } from '../storage/exportReport';
import { sha256Hex } from '../security/inputHash';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import { downloadBlob, stripPdfExt } from './appHelpers';

export interface UseSigningKeyApi {
  /** Base64 public key, or null if no key has been generated yet. */
  publicKey: string | null;
  /** Generate a new signing key, encrypted with `passphrase`. */
  createKey: (passphrase: string) => Promise<void>;
  /**
   * Best-effort copy of the base64 public key to the clipboard. CSP / focus
   * policies may block; failure is intentionally silent (UI fallback shows
   * the key inline anyway).
   */
  exportKeyToClipboard: (publicKey: string) => Promise<void>;
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
  }) => Promise<void>;
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

  const exportKeyToClipboard = useCallback(async (pk: string): Promise<void> => {
    try {
      const nav = globalThis.navigator as
        | { clipboard?: { writeText?: (s: string) => Promise<void> } }
        | undefined;
      await nav?.clipboard?.writeText?.(pk);
    } catch {
      // swallow — exporting is best-effort
    }
  }, []);

  const signAndDownloadFindings = useCallback<
    UseSigningKeyApi['signAndDownloadFindings']
  >(async ({ fileName, doc, findings, bytes, passphrase }) => {
    const inputHash = bytes ? await sha256Hex(bytes) : null;
    const unsigned = exportFindingsJson({ name: fileName, doc, findings, inputHash });
    const signed = await signExport(unsigned, passphrase);
    downloadBlob(
      signed,
      'application/json',
      `${stripPdfExt(fileName)}-findings.signed.json`,
    );
  }, []);

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
