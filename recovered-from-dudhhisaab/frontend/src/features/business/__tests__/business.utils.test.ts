import { describe, it, expect } from 'vitest';
import { getBusinessInitial, getBusinessColor, formatBusinessType } from '../business.utils';
import { BUSINESS_AVATAR_COLORS } from '../business.constants';

describe('getBusinessInitial', () => {
  it('returns first letter uppercase', () => {
    expect(getBusinessInitial('sharma dairy')).toBe('S');
  });
  it('trims whitespace before taking initial', () => {
    expect(getBusinessInitial('  krishna')).toBe('K');
  });
  it('works with already uppercase name', () => {
    expect(getBusinessInitial('FARM')).toBe('F');
  });
});

describe('getBusinessColor', () => {
  it('returns a color from the palette', () => {
    const color = getBusinessColor('biz_abc123');
    expect(BUSINESS_AVATAR_COLORS).toContainEqual(color);
  });
  it('is deterministic — same id always returns same color', () => {
    expect(getBusinessColor('xyz')).toEqual(getBusinessColor('xyz'));
  });
  it('different ids can map to different colors', () => {
    // Not guaranteed but likely for different charCodes
    const colors = BUSINESS_AVATAR_COLORS.map((_, i) =>
      getBusinessColor(String.fromCharCode(65 + i)) // A, B, C...
    );
    // At least two distinct colors exist (palette has 5 entries, 5 ids)
    const unique = new Set(colors.map(c => c.bg));
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('formatBusinessType', () => {
  it('formats known types from BUSINESS_TYPE_LABELS', () => {
    expect(formatBusinessType('dairy')).toBe('Dairy');
    expect(formatBusinessType('retail')).toBe('Retail');
    expect(formatBusinessType('wholesale')).toBe('Wholesale');
    expect(formatBusinessType('other')).toBe('Other');
  });
  it('capitalises unknown type fallback', () => {
    expect(formatBusinessType('livestock')).toBe('Livestock');
  });
  it('handles uppercase input for known types', () => {
    expect(formatBusinessType('DAIRY')).toBe('Dairy');
  });
});
