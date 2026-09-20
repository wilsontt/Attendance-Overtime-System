/** 假別清單與年假判定（對齊 PRD §7.6／data-model） */

export const KNOWN_LEAVE_TYPES = [
  '請年休假',
  '病假',
  '婚假',
  '產假',
  '育嬰假',
  '事假',
  '公假',
  '喪假',
] as const;

export type KnownLeaveType = (typeof KNOWN_LEAVE_TYPES)[number];

export const ANNUAL_LEAVE_TYPE = '請年休假';

const KNOWN_SET = new Set<string>(KNOWN_LEAVE_TYPES);

/**
 * 正規化考勤別：空白／「空」視為無假。
 */
export function normalizeAttendanceType(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '空') return null;
  return trimmed;
}

/**
 * 非空且不在清單 → 未知假別（仍可寫入打卡列，不扣年假）。
 */
export function isUnknownLeaveType(attendanceType: string | null): boolean {
  if (!attendanceType) return false;
  return !KNOWN_SET.has(attendanceType);
}

export function isAnnualLeave(attendanceType: string | null): boolean {
  return attendanceType === ANNUAL_LEAVE_TYPE;
}
