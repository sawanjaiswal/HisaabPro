/**
 * PIN-related constants (split from settings.constants.ts to keep that file
 * under the 250-line ratchet while we grow the SETTINGS_SECTIONS list).
 */

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
export const PIN_MAX_ATTEMPTS = 5
export const PIN_LOCKOUT_MINUTES = 30

/** Common weak PINs rejected on entry */
export const WEAK_PINS: string[] = [
  '1234', '0000', '1111', '2222', '3333',
  '4444', '5555', '6666', '7777', '8888',
  '9999', '4321', '1122', '2580',
]
