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

import type { AttendanceRecord, OvertimeReport, ShiftType } from '../types';

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
    } catch (error) {
      console.error('Failed to parse date:', error);
      return null;
    }
};

/**
 * 判斷日期「自然」是否為例假日（週六或週日）。
 * 此為未套用任何手動覆寫（國定假日／補班）時的預設判斷。
 * @param {string} dateStr - 日期字串（民國年格式：1141001 或西元格式）
 * @returns {boolean} 是否為例假日（無法解析日期時回傳 false，以平日計）
 */
export const isNaturalHoliday = (dateStr: string): boolean => {
  const dayOfWeek = getDayOfWeek(dateStr);
  return dayOfWeek === 0 || dayOfWeek === 6;
};


/**
 * 批次計算出勤記錄的加班時數與誤餐費
 * @param {AttendanceRecord[]} records - 出勤記錄陣列
 * @returns {OvertimeReport[]} 加班報表陣列
 */
export const calculateOvertimeAndMealAllowance = (
  records: AttendanceRecord[],
  holidayOverrides: Record<string, boolean> = {},
  weekdayOverrides: Record<string, boolean> = {},
  globalShift: ShiftType = 'company'
): OvertimeReport[] => {
  return records.flatMap(record => {
    const key = `${record.employeeId}__${record.date}`;
    
    // 判斷是否為例假日
    let isHoliday = isNaturalHoliday(record.date);
    if (holidayOverrides[key]) {
      isHoliday = true;
    } else if (weekdayOverrides[key]) {
      isHoliday = false;
    }

    const shiftType = globalShift;
    
    const clockInMinutes = parseTime(record.clockIn);
    const clockOutMinutes = parseTime(record.clockOut);

    const isFullLeave = Boolean(
      record.attendanceType &&
        record.attendanceType !== '空' &&
        record.attendanceType !== '' &&
        record.leaveQuantity != null &&
        record.leaveQuantity >= 1,
    );

    // 全天請假：不計算加班／誤餐，原因顯示請假別
    if (isFullLeave) {
      return [{
        ...record,
        overtimeHours: 0,
        mealAllowance: 0,
        overtimeRange: '',
        overtimeReason: `請${record.attendanceType}`,
        isHoliday,
        shiftType,
      }];
    }

    // 如果沒有打卡時間，無法計算加班
    if (clockInMinutes === null || clockOutMinutes === null || clockInMinutes >= clockOutMinutes) {
      return [{
        ...record,
        overtimeHours: 0,
        mealAllowance: 0,
        overtimeRange: '',
        overtimeReason: record.attendanceType && record.attendanceType !== '空' ? `請${record.attendanceType}` : '',
        isHoliday,
        shiftType
      }];
    }

    // 初始化加班原因（請假日自動填入）
    let baseOvertimeReason = '';
    if (record.attendanceType && record.attendanceType !== '空' && record.attendanceType !== '') {
      baseOvertimeReason = `請${record.attendanceType}`;
    }

    if (isHoliday) {
      // 例假日（週末／國定假日／自願加班假日）：全時段計算
      const alignedClockIn = alignStartTime(clockInMinutes);
      const alignedClockOut = alignEndTime(clockOutMinutes);
      let overtimeHours = 0;
      let overtimeRange = '';

      if (alignedClockIn < alignedClockOut) {
        const workDurationMinutes = alignedClockOut - alignedClockIn;
        overtimeHours = roundToHalfHour(workDurationMinutes / 60);
        if (overtimeHours > 0) {
          overtimeRange = `${record.clockIn} - ${record.clockOut}`;
        }
      }

      return [{
        ...record,
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        mealAllowance: 0,
        overtimeRange,
        overtimeReason: baseOvertimeReason,
        isHoliday,
        segment: '假日全段',
        shiftType
      }];
    } else {
      // 平日（含補班日）：早段與晚段
      const shiftStartMinutes = parseTime(shiftType === 'warehouse' ? '08:00' : '09:00')!;
      const shiftEndMinutes = parseTime(shiftType === 'warehouse' ? '17:00' : '18:00')!;
      
      const reports: OvertimeReport[] = [];

      // 計算早段
      const earlyEndMinutes = Math.min(clockOutMinutes, shiftStartMinutes);
      let earlyHours = 0;
      let earlyRange = '';
      if (clockInMinutes < earlyEndMinutes) {
        // 依 PRD：早段為「原始分鐘差向下取 0.5 小時」
        earlyHours = roundToHalfHour((earlyEndMinutes - clockInMinutes) / 60);
        if (earlyHours > 0) {
          // 早段加班時間顯示原始上班打卡 ~ 班表上班時間
          const shiftStartStr = shiftType === 'warehouse' ? '08:00' : '09:00';
          earlyRange = `${record.clockIn} - ${shiftStartStr}`;
          reports.push({
            ...record,
            overtimeHours: parseFloat(earlyHours.toFixed(2)),
            mealAllowance: 0,
            overtimeRange: earlyRange,
            overtimeReason: baseOvertimeReason,
            isHoliday,
            segment: '早',
            shiftType
          });
        }
      }

      // 計算晚段
      const lateStartMinutes = Math.max(clockInMinutes, shiftEndMinutes);
      let lateHours = 0;
      let lateRange = '';
      let mealAllowance = 0;
      if (lateStartMinutes < clockOutMinutes) {
        // 依 PRD：晚段為「原始分鐘差向下取 0.5 小時」
        lateHours = roundToHalfHour((clockOutMinutes - lateStartMinutes) / 60);
        if (lateHours > 0) {
          // 晚段加班時間顯示班表下班時間 ~ 原始下班打卡
          const shiftEndStr = shiftType === 'warehouse' ? '17:00' : '18:00';
          lateRange = `${shiftEndStr} - ${record.clockOut}`;
          
          // 誤餐費：下班時間 >= 19:30
          const mealAllowanceTimeMinutes = parseTime('19:30')!;
          if (clockOutMinutes >= mealAllowanceTimeMinutes) {
            mealAllowance = 50;
          }

          reports.push({
            ...record,
            overtimeHours: parseFloat(lateHours.toFixed(2)),
            mealAllowance,
            overtimeRange: lateRange,
            overtimeReason: baseOvertimeReason,
            isHoliday,
            segment: '晚',
            shiftType
          });
        }
      }

      // 如果早段晚段都沒有，回傳一筆 0 小時的記錄
      if (reports.length === 0) {
        reports.push({
          ...record,
          overtimeHours: 0,
          mealAllowance: 0,
          overtimeRange: '',
          overtimeReason: baseOvertimeReason,
          isHoliday,
          segment: '晚', // 預設給晚段
          shiftType
        });
      }

      return reports;
    }
  });
};


