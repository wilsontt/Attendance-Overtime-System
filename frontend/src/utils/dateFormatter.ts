/**
 * 日期格式化工具模組
 *
 * 用途：將民國年或西元年格式轉換為友善的顯示格式
 */

/**
 * 將出勤歸屬日期解析為 Date（支援民國 7 碼與常見西元格式）。
 * @returns 無效時回傳 null
 */
export function parseAttendanceDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  if (/^\d{7}$/.test(dateStr)) {
    const rocYear = parseInt(dateStr.substring(0, 3), 10);
    const month = parseInt(dateStr.substring(3, 5), 10);
    const day = parseInt(dateStr.substring(5, 7), 10);
    const date = new Date(rocYear + 1911, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD 或 YYYY/MM/DD：拆解後用本地 Date，避免 UTC 偏移
  const isoLike = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoLike) {
    const year = parseInt(isoLike[1]!, 10);
    const month = parseInt(isoLike[2]!, 10);
    const day = parseInt(isoLike[3]!, 10);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 將日期字串格式化為顯示格式（西元年 + 簡寫星期）
 * @param dateStr - 日期字串（民國年 7 位數字：1141001 或西元格式）
 * @returns 格式化後的日期字串（如：2025/10/01 週三）
 */
export function formatDate(dateStr: string): string {
  const date = parseAttendanceDate(dateStr);
  if (!date) {
    return dateStr;
  }

  const dayOfWeek = date.getDay();
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const dayName = `週${dayNames[dayOfWeek]}`;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}/${month}/${day} ${dayName}`;
}
