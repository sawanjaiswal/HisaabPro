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

/**
 * Normalizes and formats a person, party, or business name into clean Title Case.
 * Collapses multiple whitespaces, trims, and preserves uppercase acronyms (e.g. "PVT", "LTD").
 * Example: "  rajesh   kumar  sharma " -> "Rajesh Kumar Sharma"
 */
export function formatName(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '—';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      // Preserve standard business abbreviations
      if (/^(PVT|LTD|LLP|INC|CORP|GST|CA|DR|MR|MRS|MS|M\/S)$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Extracts 1-2 letter initials for user, customer, or business avatars.
 * Multi-word: First letter of first two words ("Sharma Trading" -> "ST")
 * Single-word: First two letters ("Amazon" -> "AM")
 * Single-char: First letter ("A" -> "A")
 */
export function formatInitials(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '?';
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const single = words[0];
  if (!single) return '?';
  return single.slice(0, 2).toUpperCase();
}

/**
 * Formats a postal address by trimming and joining non-empty parts with comma separators.
 */
export function formatAddress(parts: Array<string | null | undefined>): string {
  const cleanParts = parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));
  return cleanParts.length > 0 ? cleanParts.join(', ') : '—';
}

/**
 * Formats an Indian 6-digit PIN code.
 * Example: "110001" -> "110001" (valid) or adds space "110 001" if specified.
 */
export function formatPinCode(raw: string | null | undefined, options?: { spaced?: boolean }): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 6) return raw.trim();
  if (options?.spaced) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return digits;
}

