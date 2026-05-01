/**
 * Wave 59 Slice 1 — canonical passphrase-strength constant for all
 * panels that prompt the user to set or supply a key-derived passphrase.
 *
 * 16 characters is a defensible floor against trivial dictionary / brute
 * force attempts on the local PBKDF2 path (200k iterations). It is not a
 * security ceiling — users are encouraged to use a passphrase manager.
 *
 * This is the single source of truth so each panel's `minLength` attribute
 * and disabled-submit gate stay in lockstep with the validator copy.
 */
export const MIN_PASSPHRASE_LEN = 16;
