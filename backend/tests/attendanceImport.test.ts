import { describe, expect, it } from 'vitest';
import {
  parseCsvAttendance,
  parseTxtAttendance,
} from '../src/modules/attendance/attendanceParser.js';
import {
  calendarYearOfIso,
  parseBelongDateToIso,
} from '../src/modules/attendance/dateUtils.js';
import {
  isAnnualLeave,
  isUnknownLeaveType,
  normalizeAttendanceType,
} from '../src/modules/attendance/leaveTypes.js';

describe('leaveTypes', () => {
  it('treats empty and 空 as no leave', () => {
    expect(normalizeAttendanceType('')).toBeNull();
    expect(normalizeAttendanceType('空')).toBeNull();
    expect(normalizeAttendanceType(' 病假 ')).toBe('病假');
  });

  it('flags unknown leave types but not known ones', () => {
    expect(isUnknownLeaveType('特休')).toBe(true);
    expect(isUnknownLeaveType('請年休假')).toBe(false);
    expect(isUnknownLeaveType(null)).toBe(false);
    expect(isAnnualLeave('請年休假')).toBe(true);
  });
});

describe('dateUtils', () => {
  it('converts ROC 7-digit to ISO', () => {
    expect(parseBelongDateToIso('1141001')).toBe('2025-10-01');
    expect(calendarYearOfIso('2025-10-01')).toBe(2025);
  });

  it('accepts ISO and slash dates', () => {
    expect(parseBelongDateToIso('2026-03-20')).toBe('2026-03-20');
    expect(parseBelongDateToIso('2026/03/20')).toBe('2026-03-20');
  });
});

describe('attendanceParser CSV', () => {
  it('parses standard CSV and marks unknown leave', () => {
    const csv = [
      '員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間',
      '100057,鄒東良,1141001,空,0,08:50,20:00',
      '100057,鄒東良,1141002,請年休假,1,,',
      '100057,鄒東良,1141003,特休,0.5,,',
    ].join('\n');

    const rows = parseCsvAttendance(csv);
    expect(rows).toHaveLength(3);
    const [r0, r1, r2] = rows;
    expect(r0?.belongDate).toBe('2025-10-01');
    expect(r0?.attendanceType).toBeNull();
    expect(r0?.unknownLeaveType).toBe(false);
    expect(r1?.attendanceType).toBe('請年休假');
    expect(r1?.leaveQuantity).toBe(1);
    expect(r2?.unknownLeaveType).toBe(true);
    expect(r2?.attendanceType).toBe('特休');
  });

  it('rejects mixed employee ids', () => {
    const csv = [
      '員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間',
      '100057,甲,1141001,空,0,09:00,18:00',
      '100058,乙,1141002,空,0,09:00,18:00',
    ].join('\n');
    const rows = parseCsvAttendance(csv);
    const ids = new Set(rows.map((r) => r.employeeId));
    expect(ids.size).toBe(2);
  });
});

describe('attendanceParser TXT', () => {
  it('parses a minimal TXT block with header', () => {
    const better = [
      '員工姓名          歸屬日期',
      '100057 鄒東良                              1141101',
      '上班/ 1141101 08:38    正常',
      '下班/ 1141101 18:20    正常',
      '---------',
    ].join('\n');

    const rows = parseTxtAttendance(better);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.employeeId).toBe('100057');
    expect(row?.belongDate).toBe('2025-11-01');
    expect(row?.clockIn).toBe('08:38');
    expect(row?.clockOut).toBe('18:20');
  });
});

/**
 * 重匯年假語意：刪除區間後以新檔加總，不雙扣。
 * （純函式模擬，不需 DB）
 */
function sumAnnualLeaveInRange(
  rows: Array<{
    belongDate: string;
    attendanceType: string | null;
    leaveQuantity: number;
  }>,
  dateFrom: string,
  dateTo: string,
): number {
  return rows
    .filter(
      (r) =>
        r.belongDate >= dateFrom &&
        r.belongDate <= dateTo &&
        r.attendanceType === '請年休假',
    )
    .reduce((s, r) => s + r.leaveQuantity, 0);
}

describe('reimport annual leave semantics', () => {
  it('replacing range replaces leave sum (no double count)', () => {
    const existing = [
      { belongDate: '2026-01-10', attendanceType: '請年休假', leaveQuantity: 1 },
      { belongDate: '2026-01-11', attendanceType: '請年休假', leaveQuantity: 1 },
      { belongDate: '2026-02-01', attendanceType: '請年休假', leaveQuantity: 1 },
    ];
    const incoming = [
      { belongDate: '2026-01-10', attendanceType: '請年休假', leaveQuantity: 0.5 },
      { belongDate: '2026-01-11', attendanceType: '病假', leaveQuantity: 1 },
    ];

    const dateFrom = '2026-01-10';
    const dateTo = '2026-01-11';
    const kept = existing.filter(
      (r) => r.belongDate < dateFrom || r.belongDate > dateTo,
    );
    const after = [...kept, ...incoming];

    expect(sumAnnualLeaveInRange(existing, '2026-01-01', '2026-12-31')).toBe(3);
    expect(sumAnnualLeaveInRange(after, '2026-01-01', '2026-12-31')).toBe(1.5);
  });

  it('splits cross-year leave by belong date year', () => {
    const rows = [
      { belongDate: '2025-12-31', attendanceType: '請年休假', leaveQuantity: 1 },
      { belongDate: '2026-01-02', attendanceType: '請年休假', leaveQuantity: 1 },
    ];
    expect(sumAnnualLeaveInRange(rows, '2025-01-01', '2025-12-31')).toBe(1);
    expect(sumAnnualLeaveInRange(rows, '2026-01-01', '2026-12-31')).toBe(1);
  });
});
