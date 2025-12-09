/**
 * 加班時數與誤餐費計算服務
 * 
 * 用途：根據出勤記錄計算加班時數與誤餐費
 * 計算規則：
 * - 平日（週一至週五，非國定假日）：
 *   - 加班時數：18:00 起算至下班時間（向下對齊 30 分鐘單位）
 *   - 誤餐費：下班時間 >= 19:30 給予 $50
 * - 例假日（週六、週日或國定假日）：
 *   - 加班時數：上班時間（向上對齊整點）至下班時間（向下對齊 30 分鐘單位）
 *   - 誤餐費：不提供
 * - 時數對齊規則：
 *   - 加班時數 < 30 分鐘：不計算（返回 0）
 *   - 加班時數 ≥ 30 分鐘：向下對齊至 0.5 小時單位
 * 
 * 流程：
 * 1. 解析上下班時間為分鐘數
 * 2. 判斷日期是平日或例假日
 * 3. 根據規則計算加班時數
 * 4. 計算誤餐費
 * 5. 產生加班時間範圍字串
 */

import type { AttendanceRecord, OvertimeReport } from '../types';

/**
 * 解析時間字串（HH:mm）為自午夜起算的分鐘數
 * @param {string} timeStr - 時間字串（格式：HH:mm）
 * @returns {number | null} 分鐘數，若格式錯誤則返回 null
 */
const parseTime = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

/**
 * 將開始時間向上對齊到整點
 * @example 08:56 → 09:00
 * @param {number} timeMinutes - 原始時間（分鐘數）
 * @returns {number} 對齊後的時間（分鐘數）
 */
const alignStartTime = (timeMinutes: number): number => {
  const minutes = timeMinutes % 60;
  if (minutes === 0) {
    return timeMinutes; // 已經是整點
  }
  // 向上對齊到下一個整點
  return timeMinutes + (60 - minutes);
};

/**
 * 將結束時間向下對齊到 30 分鐘單位
 * @example 19:45 → 19:30, 17:04 → 17:00
 * @param {number} timeMinutes - 原始時間（分鐘數）
 * @returns {number} 對齊後的時間（分鐘數）
 */
const alignEndTime = (timeMinutes: number): number => {
  const minutes = timeMinutes % 60;
  if (minutes === 0 || minutes === 30) {
    return timeMinutes; // 已經對齊
  }
  if (minutes < 30) {
    // 向下對齊到整點（如 17:04 → 17:00）
    return timeMinutes - minutes;
  } else {
    // 向下對齊到 30 分（如 19:45 → 19:30）
    return timeMinutes - (minutes - 30);
  }
};

/**
 * 將時數向下對齊到 0.5 小時單位
 * 規則：加班時數 < 30 分鐘不計算，≥ 30 分鐘則向下對齊至 0.5 小時單位
 * @param {number} hours - 原始時數
 * @returns {number} 對齊後的時數（< 0.5 小時返回 0）
 * @example
 * - 0.25 小時（15分鐘）→ 0 小時
 * - 0.5 小時（30分鐘）→ 0.5 小時
 * - 0.75 小時（45分鐘）→ 0.5 小時
 * - 1.25 小時（1小時15分鐘）→ 1.0 小時
 * - 1.75 小時（1小時45分鐘）→ 1.5 小時
 */
const roundToHalfHour = (hours: number): number => {
  // 如果時數小於 0.5 小時（30分鐘），不計算加班
  if (hours < 0.5) {
    return 0;
  }
  // 將時數轉換為 30 分鐘單位並向下對齊
  const halfHourUnits = Math.floor(hours / 0.5);
  return halfHourUnits * 0.5;
};

/**
 * 取得日期的星期幾
 * @param {string} dateStr - 日期字串（民國年格式：1141001 或西元格式）
 * @returns {number | null} 星期幾（0 = 週日, 1 = 週一, ..., 6 = 週六），若格式錯誤則返回 null
 */
const getDayOfWeek = (dateStr: string): number | null => {
  try {
    let date = new Date(dateStr);

    // 嘗試解析民國年格式 (例如: 1141001 -> 2025/10/01)
    if (isNaN(date.getTime()) && /^\d{7}$/.test(dateStr)) {
      const rocYear = parseInt(dateStr.substring(0, 3));
      const month = parseInt(dateStr.substring(3, 5));
      const day = parseInt(dateStr.substring(5, 7));
      const year = rocYear + 1911;
      date = new Date(year, month - 1, day);
    }

    if (isNaN(date.getTime())) { // Check for invalid date
      return null;
    }
    return date.getDay();
  } catch (e) {
    return null;
  }
};

/**
 * 計算單筆出勤記錄的加班時數
 * @param {AttendanceRecord} record - 出勤記錄
 * @param {boolean} [isHoliday=false] - 是否為國定假日
 * @returns {number} 加班時數（< 30 分鐘返回 0，≥ 30 分鐘對齊至 0.5 小時單位）
 */
const calculateOvertimeForRecord = (record: AttendanceRecord, isHoliday: boolean = false): number => {
  const clockInMinutes = parseTime(record.clockIn);
  const clockOutMinutes = parseTime(record.clockOut);
  const dayOfWeek = getDayOfWeek(record.date);

  // 如果沒有打卡時間，無法計算加班
  if (clockInMinutes === null || clockOutMinutes === null || dayOfWeek === null || clockInMinutes >= clockOutMinutes) {
    return 0; // Invalid record
  }

  // 例假日/週末/國定假日：全時段計算
  if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
    // 上班時間向上對齊整點、下班時間向下對齊 30 分鐘單位
    const alignedClockIn = alignStartTime(clockInMinutes);
    const alignedClockOut = alignEndTime(clockOutMinutes);
    
    if (alignedClockIn >= alignedClockOut) {
      return 0; // 對齊後沒有加班時間
    }
    
    const workDurationMinutes = alignedClockOut - alignedClockIn;
    const hours = workDurationMinutes / 60;
    // 對齊到 0.5 小時單位
    return roundToHalfHour(hours);
  }
  
  // 平日（週一～週五，非國定假日）：18:00 起算
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const overtimeStartMinutes = parseTime('18:00')!; // 18:00
    
    // 下班時間向下對齊 30 分鐘單位
    const alignedClockOut = alignEndTime(clockOutMinutes);
    
    if (alignedClockOut <= overtimeStartMinutes) {
      return 0; // No overtime
    }
    
    const overtimeMinutes = alignedClockOut - overtimeStartMinutes;
    const hours = overtimeMinutes / 60;
    // 對齊到 0.5 小時單位
    return roundToHalfHour(hours);
  }

  return 0;
};

/**
 * 計算單筆出勤記錄的誤餐費
 * @param {AttendanceRecord} record - 出勤記錄
 * @param {boolean} [isHoliday=false] - 是否為國定假日
 * @returns {number} 誤餐費金額（平日下班 >= 19:30 給予 $50，其他情況為 $0）
 */
const calculateMealAllowanceForRecord = (record: AttendanceRecord, isHoliday: boolean = false): number => {
  const clockOutMinutes = parseTime(record.clockOut);
  const dayOfWeek = getDayOfWeek(record.date);

  if (clockOutMinutes === null || dayOfWeek === null) {
    return 0; // Invalid record
  }

  // 週末和國定假日：無誤餐費
  if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
    return 0;
  }

  // 平日（週一～週五，非國定假日）：下班時間 >= 19:30 → 50 元
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const mealAllowanceTimeMinutes = parseTime('19:30')!; // 19:30
    if (clockOutMinutes >= mealAllowanceTimeMinutes) {
      return 50;
    }
  }
  
  return 0;
};

/**
 * 批次計算出勤記錄的加班時數與誤餐費
 * @param {AttendanceRecord[]} records - 出勤記錄陣列
 * @returns {OvertimeReport[]} 加班報表陣列
 */
export const calculateOvertimeAndMealAllowance = (
  records: AttendanceRecord[]
): OvertimeReport[] => {
  return records.map(record => {
    // 預設不是國定假日（可在 PreviewModal 中調整）
    const isHoliday = false;
    
    const overtimeHours = calculateOvertimeForRecord(record, isHoliday);
    const mealAllowance = calculateMealAllowanceForRecord(record, isHoliday);
    
    // Calculate overtime range（顯示原始打卡時間，不顯示對齊後的時間）
    let overtimeRange = '';
    const dayOfWeek = getDayOfWeek(record.date);
    if (overtimeHours > 0 && dayOfWeek !== null) {
      // 例假日/週末/國定假日：顯示原始上班打卡時間 ~ 原始下班打卡時間
      if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
        overtimeRange = `${record.clockIn} - ${record.clockOut}`;
      } 
      // 平日：顯示 18:00 ~ 原始下班打卡時間
      else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        overtimeRange = `18:00 - ${record.clockOut}`;
      }
    }

    // 初始化加班原因（請假日自動填入）
    let overtimeReason = '';
    if (record.attendanceType && record.attendanceType !== '空' && record.attendanceType !== '') {
      overtimeReason = `請${record.attendanceType}`;
    }

    return {
      ...record,
      overtimeHours: parseFloat(overtimeHours.toFixed(2)), // Ensure two decimal places
      mealAllowance,
      overtimeRange,
      overtimeReason,
      isHoliday, // 加入 isHoliday 欄位
    };
  });
};

/**
 * 重新計算加班報表（用於調整國定假日標記後重新計算）
 * @param {OvertimeReport} report - 原始加班報表
 * @param {boolean} isHoliday - 是否為國定假日
 * @returns {OvertimeReport} 重新計算後的加班報表
 */
export const recalculateOvertimeReport = (report: OvertimeReport, isHoliday: boolean): OvertimeReport => {
  const record: AttendanceRecord = {
    employeeId: report.employeeId,
    name: report.name,
    date: report.date,
    attendanceType: report.attendanceType,
    leaveQuantity: report.leaveQuantity,
    clockIn: report.clockIn,
    clockOut: report.clockOut,
  };

  const overtimeHours = calculateOvertimeForRecord(record, isHoliday);
  const mealAllowance = calculateMealAllowanceForRecord(record, isHoliday);
  
  // Recalculate overtime range（顯示原始打卡時間，不顯示對齊後的時間）
  let overtimeRange = '';
  const dayOfWeek = getDayOfWeek(record.date);
  if (overtimeHours > 0 && dayOfWeek !== null) {
    // 例假日/週末/國定假日：顯示原始上班打卡時間 ~ 原始下班打卡時間
    if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
      overtimeRange = `${record.clockIn} - ${record.clockOut}`;
    } 
    // 平日：顯示 18:00 ~ 原始下班打卡時間
    else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      overtimeRange = `18:00 - ${record.clockOut}`;
    }
  }

  return {
    ...report,
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    mealAllowance,
    overtimeRange,
    isHoliday,
  };
};

