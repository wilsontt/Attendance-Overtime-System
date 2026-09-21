import { describe, expect, it } from 'vitest';
import type { OvertimeReport } from '../../src/types';
import {
  hasLeaveType,
  isFullDayLeave,
  lookupKeyedValue,
  reportSegmentKey,
  resolveEditedReason,
} from '../../src/utils/previewModalHelpers';

const base = (
  overrides: Partial<OvertimeReport> = {},
): OvertimeReport => ({
  employeeId: '100057',
  name: '測',
  date: '1141001',
  clockIn: '09:00',
  clockOut: '20:00',
  overtimeHours: 2,
  mealAllowance: 50,
  overtimeRange: '18:00 - 20:00',
  overtimeReason: '原原因',
  segment: '晚',
  ...overrides,
});

describe('previewModalHelpers', () => {
  it('isFullDayLeave 僅 leaveQuantity >= 1', () => {
    expect(
      isFullDayLeave(base({ attendanceType: '事假', leaveQuantity: 1 })),
    ).toBe(true);
    expect(
      isFullDayLeave(base({ attendanceType: '事假', leaveQuantity: 0.5 })),
    ).toBe(false);
    expect(isFullDayLeave(base({ attendanceType: '', leaveQuantity: 1 }))).toBe(
      false,
    );
  });

  it('hasLeaveType 辨識部分請假', () => {
    expect(hasLeaveType(base({ attendanceType: '事假' }))).toBe(true);
    expect(hasLeaveType(base({ attendanceType: '空' }))).toBe(false);
  });

  it('lookupKeyedValue 在 segment 變更後仍可取同日舊值', () => {
    const map = { '100057__1141001__晚': true };
    const holiday = base({ segment: '假日全段' });
    expect(lookupKeyedValue(map, holiday)).toBe(true);
    expect(reportSegmentKey(holiday)).toBe('100057__1141001__假日全段');
  });

  it('resolveEditedReason 保留空字串', () => {
    expect(resolveEditedReason('', '舊')).toBe('');
    expect(resolveEditedReason(undefined, '舊')).toBe('舊');
    expect(resolveEditedReason('新', '舊')).toBe('新');
  });
});
