/** 假別清單與未知判定（對齊 PRD §7.6／後端 leaveTypes） */

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

/** 正式清單假別名稱，供 TXT regex 使用。 */
export const KNOWN_LEAVE_TYPE_PATTERN = KNOWN_LEAVE_TYPES.join('|');

/**
 * 非空且不在清單 → 未知假別（如颱風假）。
 */
export function isUnknownLeaveType(
  attendanceType: string | null | undefined,
): boolean {
  if (!attendanceType) return false;
  return !KNOWN_SET.has(attendanceType);
}
