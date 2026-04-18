import { PasswordProtectedPdfError } from './types';

export function mapPdfError(err: unknown): Error {
  if (err instanceof Error) {
    if (err.name === 'PasswordException') {
      return new PasswordProtectedPdfError();
    }
    return err;
  }
  return new Error(`Unknown PDF error: ${String(err)}`);
}
