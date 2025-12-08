import type { AttendanceRecord, OvertimeReport } from '../types';

// Helper to parse time strings (HH:mm) into minutes from midnight
const parseTime = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

// 將時間（分鐘）轉換回時間字串 (HH:mm)
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// 將開始時間向上對齊到整點（08:56 → 09:00）
const alignStartTime = (timeMinutes: number): number => {
  const minutes = timeMinutes % 60;
  if (minutes === 0) {
    return timeMinutes; // 已經是整點
  }
  // 向上對齊到下一個整點
  return timeMinutes + (60 - minutes);
};

// 將結束時間向下對齊到 30 分鐘單位（19:45 → 19:30，17:04 → 17:00）
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

// 將時數對齊到 0.5 小時單位（向下對齊）
const roundToHalfHour = (hours: number): number => {
  // 將時數轉換為 30 分鐘單位
  const halfHourUnits = Math.floor(hours / 0.5);
  return halfHourUnits * 0.5;
};

// Helper to get day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
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

export const calculateOvertimeAndMealAllowance = (
  records: AttendanceRecord[]
): OvertimeReport[] => {
  return records.map(record => {
    // 預設不是國定假日（可在 PreviewModal 中調整）
    const isHoliday = false;
    
    const overtimeHours = calculateOvertimeForRecord(record, isHoliday);
    const mealAllowance = calculateMealAllowanceForRecord(record, isHoliday);
    
    // Calculate overtime range（顯示對齊後的時間）
    let overtimeRange = '';
    const dayOfWeek = getDayOfWeek(record.date);
    if (overtimeHours > 0 && dayOfWeek !== null) {
      const clockInMinutes = parseTime(record.clockIn);
      const clockOutMinutes = parseTime(record.clockOut);
      
      if (clockInMinutes !== null && clockOutMinutes !== null) {
        // 例假日/週末/國定假日：全時段（顯示對齊後的時間）
        if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
          const alignedClockIn = alignStartTime(clockInMinutes);
          const alignedClockOut = alignEndTime(clockOutMinutes);
          overtimeRange = `${minutesToTime(alignedClockIn)} - ${minutesToTime(alignedClockOut)}`;
        } 
        // 平日：18:00 起算（顯示對齊後的結束時間）
        else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const alignedClockOut = alignEndTime(clockOutMinutes);
          overtimeRange = `18:00 - ${minutesToTime(alignedClockOut)}`;
        }
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
 * 重新計算加班時數（用於 PreviewModal 中調整國定假日標記後重新計算）
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
  
  // Recalculate overtime range（顯示對齊後的時間）
  let overtimeRange = '';
  const dayOfWeek = getDayOfWeek(record.date);
  if (overtimeHours > 0 && dayOfWeek !== null) {
    const clockInMinutes = parseTime(record.clockIn);
    const clockOutMinutes = parseTime(record.clockOut);
    
    if (clockInMinutes !== null && clockOutMinutes !== null) {
      if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
        const alignedClockIn = alignStartTime(clockInMinutes);
        const alignedClockOut = alignEndTime(clockOutMinutes);
        overtimeRange = `${minutesToTime(alignedClockIn)} - ${minutesToTime(alignedClockOut)}`;
      } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const alignedClockOut = alignEndTime(clockOutMinutes);
        overtimeRange = `18:00 - ${minutesToTime(alignedClockOut)}`;
      }
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

