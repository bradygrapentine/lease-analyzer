import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  friendlyError,
  readFileBytes,
  stripPdfExt,
  leaseFactsToIcsDates,
  buildIcsBytes,
  exportEncryptedArchiveFlow,
  importEncryptedArchiveFlow,
  clearAllFlow,
} from './appHelpers';
import { PasswordProtectedPdfError } from '../parser/types';
import type { LeaseDocument } from '../parser/types';
import type { LeaseFacts } from '../facts/types';

beforeEach(() => {
  // jsdom doesn't implement URL.createObjectURL; assign instead of spying
  // because the property is undefined on the URL constructor.
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi
    .fn()
    .mockReturnValue('blob:stub');
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('friendlyError', () => {
  it('returns the PasswordProtectedPdfError message verbatim', () => {
    const err = new PasswordProtectedPdfError();
    expect(friendlyError(err)).toMatch(/password-protected/i);
  });

  it('returns the Error message for plain Error', () => {
    expect(friendlyError(new Error('boom'))).toBe('boom');
  });

  it('coerces non-Error throws to string', () => {
    expect(friendlyError({ weird: true })).toBe('[object Object]');
    expect(friendlyError(42)).toBe('42');
    expect(friendlyError('plain string')).toBe('plain string');
  });
});

describe('readFileBytes', () => {
  it('uses File.arrayBuffer when present', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'x.pdf');
    const bytes = await readFileBytes(file);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('falls back to FileReader when arrayBuffer is missing', async () => {
    const fakeFile = {
      // no arrayBuffer method
    } as unknown as File;
    // Stub FileReader to immediately resolve with a known buffer.
    const buf = new Uint8Array([7, 8, 9]).buffer;
    class FakeReader {
      result: ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer(): void {
        this.result = buf;
        queueMicrotask(() => this.onload?.());
      }
      get error(): null {
        return null;
      }
    }
    vi.stubGlobal('FileReader', FakeReader as unknown);
    const bytes = await readFileBytes(fakeFile);
    expect(bytes).toEqual(new Uint8Array([7, 8, 9]));
  });

  it('rejects via FileReader.onerror when the read fails', async () => {
    const fakeFile = {} as unknown as File;
    class ErrReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer(): void {
        queueMicrotask(() => this.onerror?.());
      }
      get error(): Error {
        return new Error('disk on fire');
      }
    }
    vi.stubGlobal('FileReader', ErrReader as unknown);
    await expect(readFileBytes(fakeFile)).rejects.toThrow('disk on fire');
  });
});

describe('stripPdfExt', () => {
  it('strips a trailing .pdf', () => {
    expect(stripPdfExt('Lease.pdf')).toBe('Lease');
  });

  it('is case-insensitive', () => {
    expect(stripPdfExt('Lease.PDF')).toBe('Lease');
  });

  it('leaves names without a .pdf suffix unchanged', () => {
    expect(stripPdfExt('Lease.txt')).toBe('Lease.txt');
    expect(stripPdfExt('NoExtension')).toBe('NoExtension');
  });
});

describe('leaseFactsToIcsDates', () => {
  function facts(overrides: Partial<LeaseFacts> = {}): LeaseFacts {
    return {
      tenantName: null,
      landlordName: null,
      monthlyRent: null,
      securityDeposit: null,
      commencementDate: null,
      expirationDate: null,
      noticePeriodDays: null,
      ...overrides,
    } as LeaseFacts;
  }

  it('returns empty when no dates are extractable', () => {
    expect(leaseFactsToIcsDates(facts())).toEqual([]);
  });

  it('emits a single commencement event when only that date is set', () => {
    const out = leaseFactsToIcsDates(facts({ commencementDate: '2026-01-01' }));
    expect(out).toEqual([{ summary: 'Lease commences', date: '2026-01-01' }]);
  });

  it('emits commencement + expiration when both are set, no notice', () => {
    const out = leaseFactsToIcsDates(
      facts({ commencementDate: '2026-01-01', expirationDate: '2027-01-01' }),
    );
    expect(out.map((e) => e.summary)).toEqual(['Lease commences', 'Lease expires']);
  });

  it('emits a notice-deadline event when expiration + noticePeriodDays are set', () => {
    const out = leaseFactsToIcsDates(facts({ expirationDate: '2027-01-31', noticePeriodDays: 30 }));
    expect(out).toHaveLength(2); // expiration + notice
    const notice = out.find((e) => e.summary.includes('Notice deadline'));
    expect(notice?.date).toBe('2027-01-01');
  });

  it('skips the notice event when noticePeriodDays is set but expiration is not', () => {
    const out = leaseFactsToIcsDates(facts({ noticePeriodDays: 30 }));
    expect(out).toEqual([]);
  });

  it('skips the notice event when subtractDaysIso receives a malformed date', () => {
    // The internal subtractDaysIso requires YYYY-MM-DD; a malformed expiration
    // date returns null and the notice entry is dropped.
    const out = leaseFactsToIcsDates(
      facts({ expirationDate: 'not-a-date' as string, noticePeriodDays: 30 }),
    );
    // Expiration entry still emitted; notice entry suppressed.
    expect(out.map((e) => e.summary)).toEqual(['Lease expires']);
  });
});

describe('buildIcsBytes', () => {
  function leaseDoc(): LeaseDocument {
    return { pages: [], paragraphs: [], sections: [], raw: '' };
  }

  it('returns null when no dates are extractable', () => {
    const result = buildIcsBytes({ fileName: 'empty.pdf', doc: leaseDoc() });
    expect(result).toBeNull();
  });
});

describe('exportEncryptedArchiveFlow', () => {
  it('is a no-op when the user cancels the passphrase prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    await exportEncryptedArchiveFlow();
    expect(promptSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('is a no-op when the user submits an empty passphrase', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('');
    await exportEncryptedArchiveFlow();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('importEncryptedArchiveFlow', () => {
  function fakeFile(): File {
    return new File([new Uint8Array([0])], 'archive.lgarchive');
  }

  it('is a no-op when the user cancels the passphrase prompt', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    await importEncryptedArchiveFlow(fakeFile(), { onSuccess, onError });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('routes a wrong-passphrase error to onError with the underlying message', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('wrong');
    const onSuccess = vi.fn();
    const onError = vi.fn();
    // Garbage bytes → archive header check throws WrongPassphraseError or
    // similar; either path lands in the catch block we want to cover.
    await importEncryptedArchiveFlow(fakeFile(), { onSuccess, onError });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatch(/passphrase|Import failed/i);
  });
});

describe('clearAllFlow', () => {
  it('returns false and skips clearing when the user cancels the confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCleared = vi.fn();
    const result = await clearAllFlow({ onCleared });
    expect(result).toBe(false);
    expect(onCleared).not.toHaveBeenCalled();
  });
});
