import type { OvertimeReport } from '../types';

/** 全天請假：有假別且 leaveQuantity >= 1 */
export function isFullDayLeave(
  report: Pick<OvertimeReport, 'attendanceType' | 'leaveQuantity'>,
): boolean {
  return Boolean(
    report.attendanceType &&
      report.attendanceType !== '空' &&
      report.attendanceType !== '' &&
      report.leaveQuantity != null &&
      report.leaveQuantity >= 1,
  );
}

/** 有假別（含部分請假） */
export function hasLeaveType(
  report: Pick<OvertimeReport, 'attendanceType'>,
): boolean {
  return Boolean(
    report.attendanceType &&
      report.attendanceType !== '空' &&
      report.attendanceType !== '',
  );
}

export function reportSegmentKey(report: OvertimeReport): string {
  return `${report.employeeId}__${report.date}__${report.segment || '全'}`;
}

export function reportDayPrefix(report: OvertimeReport): string {
  return `${report.employeeId}__${report.date}__`;
}

/**
 * 從舊 key map 取值：先精確 key，再同日任意 segment（平假日切換後 segment 會變）。
 */
export function lookupKeyedValue<T>(
  map: Record<string, T>,
  report: OvertimeReport,
): T | undefined {
  const exact = reportSegmentKey(report);
  if (Object.prototype.hasOwnProperty.call(map, exact)) {
    return map[exact];
  }
  const prefix = reportDayPrefix(report);
  const entry = Object.entries(map).find(([k]) => k.startsWith(prefix));
  return entry?.[1];
}

/** 編輯原因：空字串保留，不回退到舊值 */
export function resolveEditedReason(
  edited: string | undefined,
  fallback: string,
): string {
  return edited !== undefined ? edited : fallback;
}
