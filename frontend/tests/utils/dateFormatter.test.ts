import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateWithFullWeekday,
  parseAttendanceDate,
} from '../../src/utils/dateFormatter';

describe('parseAttendanceDate', () => {
  it('解析民國年 7 碼為本地 Date', () => {
    const d = parseAttendanceDate('1141001');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(9);
    expect(d!.getDate()).toBe(1);
  });

  it('解析 ISO 日期', () => {
    const d = parseAttendanceDate('2025-10-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(9);
    expect(d!.getDate()).toBe(1);
  });

  it('無效字串回傳 null', () => {
    expect(parseAttendanceDate('')).toBeNull();
    expect(parseAttendanceDate('abc')).toBeNull();
  });
});

describe('formatDate / formatDateWithFullWeekday', () => {
  it('formatDate 使用簡寫「週X」', () => {
    // 2025-10-01 為星期三
    expect(formatDate('2025-10-01')).toBe('2025/10/01 週三');
  });

  it('formatDateWithFullWeekday 使用完整「星期X」', () => {
    expect(formatDateWithFullWeekday('2025-10-01')).toBe(
      '2025/10/01 星期三',
    );
  });
});
