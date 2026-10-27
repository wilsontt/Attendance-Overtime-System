import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MAX_BYTES,
  validatePasswordStrength,
} from '../src/lib/passwordPolicy.js';

const VALID = 'Abcdefgh1234!';

describe('validatePasswordStrength', () => {
  it('合規密碼回傳空陣列', () => {
    expect(validatePasswordStrength(VALID)).toEqual([]);
  });

  it('少於 12 字元時回報長度', () => {
    const result = validatePasswordStrength('Abcdefg123!');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('至少 12 字元');
  });

  it.each([
    ['缺大寫', 'abcdefgh1234!', '需包含大寫字母'],
    ['缺小寫', 'ABCDEFGH1234!', '需包含小寫字母'],
    ['缺數字', 'Abcdefghijkl!', '需包含數字'],
    ['缺符號', 'Abcdefgh12345', '需包含符號'],
  ])('%s 時只回報對應訊息', (_name, password, message) => {
    expect(validatePasswordStrength(password)).toEqual([message]);
  });

  it('空字串回報多項違規且不拋例外', () => {
    expect(validatePasswordStrength('').length).toBeGreaterThanOrEqual(5);
  });

  it('超過 72 位元組時回報警告', () => {
    const password = `Aa1!${'x'.repeat(PASSWORD_MAX_BYTES - 3)}`; // 73 位元組
    expect(Buffer.byteLength(password, 'utf8')).toBe(PASSWORD_MAX_BYTES + 1);
    const result = validatePasswordStrength(password);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('警告');
    expect(result[0]).toContain('過長');
  });

  it('恰為 72 位元組時通過', () => {
    const password = `Aa1!${'x'.repeat(PASSWORD_MAX_BYTES - 4)}`;
    expect(Buffer.byteLength(password, 'utf8')).toBe(PASSWORD_MAX_BYTES);
    expect(validatePasswordStrength(password)).toEqual([]);
  });

  it('中文字不算符號', () => {
    expect(validatePasswordStrength('Abcdefgh1234中文')).toEqual([
      '需包含符號',
    ]);
  });
});
