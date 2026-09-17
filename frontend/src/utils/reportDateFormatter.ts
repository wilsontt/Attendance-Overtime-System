import type { OvertimeReport } from '../types';
import { formatDate } from './dateFormatter';

/**
 * 將報表段別轉為輸出用短標籤。
 *
 * @param segment - 加班段別
 * @returns 日期欄要附加在星期後方的段別文字
 */
export function getReportSegmentLabel(
  segment?: OvertimeReport['segment'],
): string {
  if (segment === '早') return '早段';
  if (segment === '晚') return '晚段';
  if (segment === '假日全段') return '全段';
  return '';
}

/**
 * 格式化報表日期，並在星期後方附加早段／晚段／全段。
 *
 * @param report - 加班報表記錄
 * @returns 例如：2026/03/25 週三 早段
 */
export function formatReportDateWithSegment(
  report: Pick<OvertimeReport, 'date' | 'segment'>,
): string {
  const formattedDate = formatDate(report.date);
  const segmentLabel = getReportSegmentLabel(report.segment);
  return segmentLabel ? `${formattedDate} ${segmentLabel}` : formattedDate;
}
