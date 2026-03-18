import { BUSINESS_AVATAR_COLORS, BUSINESS_TYPE_LABELS } from './business.constants';

export function getBusinessInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function getBusinessColor(id: string): { bg: string; text: string } {
  const idx = id.charCodeAt(0) % BUSINESS_AVATAR_COLORS.length;
  return BUSINESS_AVATAR_COLORS[idx];
}

export function formatBusinessType(type: string): string {
  return BUSINESS_TYPE_LABELS[type.toLowerCase()] ?? (type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
}
