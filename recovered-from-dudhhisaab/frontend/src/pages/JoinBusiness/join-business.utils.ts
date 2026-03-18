import { JOIN_CODE_REGEX, JOIN_CODE_LENGTH } from './join-business.constants';

/**
 * Normalises raw input: uppercase, strip non-alphanumeric, clamp to 6 chars.
 */
export function formatJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, JOIN_CODE_LENGTH);
}

/**
 * Returns true when the code matches exactly 6 uppercase alphanumeric chars.
 */
export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_REGEX.test(code);
}
