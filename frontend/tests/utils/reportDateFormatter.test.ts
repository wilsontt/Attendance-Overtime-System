import { describe, expect, it } from 'vitest';
import { formatReportDateWithSegment } from '../../src/utils/reportDateFormatter';
import type { OvertimeReport } from '../../src/types';

const createReport = (
  segment?: OvertimeReport['segment'],
  date = '2026-03-25',
): OvertimeReport => ({
  employeeId: 'emp001',
  name: '測試員工',
  date,
  clockIn: '08:01',
  clockOut: '19:08',
  overtimeHours: 1,
  mealAllowance: 0,
  overtimeRange: '18:00 - 19:08',
  overtimeReason: '測試',
  segment,
});

describe('formatReportDateWithSegment', () => {
  it('adds early and late segment labels after the weekday', () => {
    expect(formatReportDateWithSegment(createReport('早'))).toBe(
      '2026/03/25 週三 早段',
    );
    expect(formatReportDateWithSegment(createReport('晚'))).toBe(
      '2026/03/25 週三 晚段',
    );
  });

  it('shortens holiday full-day segment and leaves records without segment unchanged', () => {
    expect(formatReportDateWithSegment(createReport('假日全段'))).toBe(
      '2026/03/25 週三 全段',
    );
    expect(formatReportDateWithSegment(createReport(undefined))).toBe(
      '2026/03/25 週三',
    );
  });
});
