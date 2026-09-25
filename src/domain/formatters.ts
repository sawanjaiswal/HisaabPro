/**
 * Gold Standard Domain Formatters (Indian Fintech SSOT)
 */

/**
 * Formats a numeric amount in Indian Rupees (₹) with standard Indian comma grouping (lakhs/crores).
 * Example: 125000 -> "₹1,25,000"
 */
export function formatINR(amount: number | string | null | undefined, options?: { showDecimals?: boolean }): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0';
  }
  const numericVal = Number(amount);
  const showDecimals = options?.showDecimals ?? false;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  }).format(numericVal);
}

/**
 * Formats a currency amount in minor units (paise) to INR display string.
 * Example: 12500000 paise -> "₹1,25,000" or 1250 paise -> "₹12.50"
 */
export function formatPaiseToINR(paise: number | string | null | undefined, options?: { forceDecimals?: boolean }): string {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    return '₹0';
  }
  const numericPaise = Number(paise);
  const rupees = numericPaise / 100;
  const hasFractions = rupees % 1 !== 0 || options?.forceDecimals;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFractions ? 2 : 0,
  }).format(rupees);
}

/**
 * Formats an Indian 10-digit phone/mobile number for clear visual display.
 * Example: "9826012345" -> "+91 98260 12345"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone.trim();
}

/**
 * Formats a 15-digit Goods and Services Tax Identification Number (GSTIN).
 * Example: "23aaaaa0000a1z5" -> "23AAAAA0000A1Z5"
 */
export function formatGSTIN(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Formats a 10-digit Permanent Account Number (PAN).
 * Example: "abcde1234f" -> "ABCDE1234F"
 */
export function formatPAN(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Formats a 12-digit Aadhaar number with masking for statutory privacy.
 * Example: "123456789012" -> "•••• •••• 9012"
 */
export function formatAadhaarMasked(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 12) return raw;
  return `•••• •••• ${digits.slice(8)}`;
}

/**
 * Formats statutory invoice or document numbers
 */
export function formatInvoiceNumber(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.trim().toUpperCase();
}
