/**
 * 假勤摘要加總（純函式，對齊 PRD §5.5.1）。
 * 未出現的清單假別回 0；未知假別不計入。
 */

import {
  ANNUAL_LEAVE_TYPE,
  KNOWN_LEAVE_TYPES,
} from '../attendance/leaveTypes.js';

export const NON_ANNUAL_LEAVE_TYPES = KNOWN_LEAVE_TYPES.filter(
  (type) => type !== ANNUAL_LEAVE_TYPE,
);

export type LeaveQuantityRow = {
  attendanceType: string | null;
  leaveQuantity: number;
  unknownLeaveType: boolean;
};

export type LeaveSummaryTotals = {
  annualLeave: {
    quotaDays: number;
    usedDays: number;
    remainingDays: number;
  };
  leaveTotals: Array<{
    leaveType: (typeof NON_ANNUAL_LEAVE_TYPES)[number];
    usedDays: number;
  }>;
};

export function summarizeLeaveQuantities(
  rows: LeaveQuantityRow[],
  quotaDays: number,
): LeaveSummaryTotals {
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (row.unknownLeaveType || !row.attendanceType) continue;
    if (!KNOWN_LEAVE_TYPES.includes(row.attendanceType as (typeof KNOWN_LEAVE_TYPES)[number])) {
      continue;
    }
    const prev = sums.get(row.attendanceType) ?? 0;
    sums.set(row.attendanceType, prev + row.leaveQuantity);
  }

  const usedDays = sums.get(ANNUAL_LEAVE_TYPE) ?? 0;

  return {
    annualLeave: {
      quotaDays,
      usedDays,
      remainingDays: quotaDays - usedDays,
    },
    leaveTotals: NON_ANNUAL_LEAVE_TYPES.map((leaveType) => ({
      leaveType,
      usedDays: sums.get(leaveType) ?? 0,
    })),
  };
}
