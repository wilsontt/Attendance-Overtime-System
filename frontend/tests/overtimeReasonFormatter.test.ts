import { describe, expect, it } from 'vitest';
import { normalizeOvertimeReasonForPrint } from '../src/utils/overtimeReasonFormatter';

describe('normalizeOvertimeReasonForPrint', () => {
  it('converts halfwidth english, digits, symbols, and spaces to fullwidth', () => {
    expect(normalizeOvertimeReasonForPrint('abc123-_= ,.')).toBe('ａｂｃ１２３－＿＝　，．');
  });

  it('keeps CJK characters unchanged while converting adjacent ASCII text', () => {
    expect(normalizeOvertimeReasonForPrint('加班A1 測試!')).toBe('加班Ａ１　測試！');
  });

  it('returns an empty string when reason is empty', () => {
    expect(normalizeOvertimeReasonForPrint('')).toBe('');
  });
});
