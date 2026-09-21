import { describe, expect, it } from 'vitest';
import { summarizeLeaveQuantities } from '../src/modules/calendar/leaveSummary.js';

describe('summarizeLeaveQuantities', () => {
  it('sums annual leave and shows 0 for unused types; ignores unknown', () => {
    const result = summarizeLeaveQuantities(
      [
        { attendanceType: '請年休假', leaveQuantity: 1, unknownLeaveType: false },
        { attendanceType: '請年休假', leaveQuantity: 0.5, unknownLeaveType: false },
        { attendanceType: '事假', leaveQuantity: 1, unknownLeaveType: false },
        { attendanceType: '病假', leaveQuantity: 0.5, unknownLeaveType: false },
        { attendanceType: '特休', leaveQuantity: 2, unknownLeaveType: true },
        { attendanceType: null, leaveQuantity: 0, unknownLeaveType: false },
      ],
      14,
    );

    expect(result.annualLeave).toEqual({
      quotaDays: 14,
      usedDays: 1.5,
      remainingDays: 12.5,
    });
    expect(result.leaveTotals).toEqual([
      { leaveType: '病假', usedDays: 0.5 },
      { leaveType: '婚假', usedDays: 0 },
      { leaveType: '產假', usedDays: 0 },
      { leaveType: '育嬰假', usedDays: 0 },
      { leaveType: '事假', usedDays: 1 },
      { leaveType: '公假', usedDays: 0 },
      { leaveType: '喪假', usedDays: 0 },
    ]);
  });

  it('allows negative remaining when over quota', () => {
    const result = summarizeLeaveQuantities(
      [{ attendanceType: '請年休假', leaveQuantity: 3, unknownLeaveType: false }],
      1,
    );
    expect(result.annualLeave.remainingDays).toBe(-2);
  });
});
