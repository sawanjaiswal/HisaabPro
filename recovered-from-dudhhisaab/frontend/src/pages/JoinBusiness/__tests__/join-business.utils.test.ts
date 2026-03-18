import { describe, it, expect } from 'vitest';
import { formatJoinCode, isValidJoinCode } from '../join-business.utils';

describe('formatJoinCode', () => {
  it('uppercases lowercase input', () => {
    expect(formatJoinCode('abc123')).toBe('ABC123');
  });
  it('strips non-alphanumeric characters', () => {
    expect(formatJoinCode('AB-CD 12')).toBe('ABCD12');
  });
  it('truncates to 6 characters', () => {
    expect(formatJoinCode('ABCDEFGH')).toBe('ABCDEF');
  });
  it('handles empty string', () => {
    expect(formatJoinCode('')).toBe('');
  });
  it('handles partial input', () => {
    expect(formatJoinCode('AB3')).toBe('AB3');
  });
});

describe('isValidJoinCode', () => {
  it('accepts valid 6-char uppercase alphanumeric code', () => {
    expect(isValidJoinCode('ABC123')).toBe(true);
    expect(isValidJoinCode('QYZJZU')).toBe(true);
  });
  it('accepts lowercase (regex is case-insensitive)', () => {
    expect(isValidJoinCode('abc123')).toBe(true);
  });
  it('rejects codes shorter than 6 chars', () => {
    expect(isValidJoinCode('ABC12')).toBe(false);
  });
  it('rejects codes longer than 6 chars', () => {
    expect(isValidJoinCode('ABC1234')).toBe(false);
  });
  it('rejects codes with special characters', () => {
    expect(isValidJoinCode('AB-123')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidJoinCode('')).toBe(false);
  });
});
