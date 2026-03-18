import { BUSINESS_TYPE_OPTIONS } from './business-management.constants';

/**
 * Returns human-readable label for a business type value.
 * Falls back to capitalised raw value if not found in options.
 */
export function getBusinessTypeLabel(type: string): string {
  const match = BUSINESS_TYPE_OPTIONS.find((o) => o.value === type);
  if (match) return match.label;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Formats a creation date as a relative or absolute string.
 * Example: "Mar 2026"
 */
export function formatBusinessCreatedAt(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Masks a join code for privacy — shows 3 dots followed by last 3 chars.
 */
export function maskJoinCode(code: string): string {
  if (code.length <= 3) return '•'.repeat(code.length);
  return `•••${code.slice(-3)}`;
}

/**
 * Validates business name: min 2 non-whitespace chars.
 */
export function validateBusinessName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Business name must be at least 2 characters';
  return null;
}
