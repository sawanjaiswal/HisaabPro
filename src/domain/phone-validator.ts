/**
 * Phone validator & normalizer for Indian 10-digit mobile numbers
 */

const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

export function isValidIndianPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return INDIAN_PHONE_REGEX.test(digits);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return INDIAN_PHONE_REGEX.test(digits.slice(2));
  }
  return false;
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.slice(-10);
}
