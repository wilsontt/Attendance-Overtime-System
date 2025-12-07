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

const calculateOvertimeForRecord = (record: AttendanceRecord): number => {
  const clockInMinutes = parseTime(record.clockIn);
  const clockOutMinutes = parseTime(record.clockOut);
  const dayOfWeek = getDayOfWeek(record.date);

  if (clockInMinutes === null || clockOutMinutes === null || dayOfWeek === null || clockInMinutes >= clockOutMinutes) {
    return 0; // Invalid record
  }

  const workDurationMinutes = clockOutMinutes - clockInMinutes;

  // Monday to Friday
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const overtimeStartMinutes = parseTime('18:00')!; // 18:00
    if (clockOutMinutes <= overtimeStartMinutes) {
      return 0; // No overtime
    }
    return (clockOutMinutes - overtimeStartMinutes) / 60; // Convert to hours
  } 
  // Saturday (6) and Sunday (0)
  else if (dayOfWeek === 0 || dayOfWeek === 6) {
    return workDurationMinutes / 60; // All hours are overtime
  }

  return 0;
};

const calculateMealAllowanceForRecord = (record: AttendanceRecord): number => {
  const clockOutMinutes = parseTime(record.clockOut);
  const dayOfWeek = getDayOfWeek(record.date);

  if (clockOutMinutes === null || dayOfWeek === null) {
    return 0; // Invalid record
  }

  // Monday to Friday, if clock out >= 19:30
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const mealAllowanceTimeMinutes = parseTime('19:30')!; // 19:30
    if (clockOutMinutes >= mealAllowanceTimeMinutes) {
      return 50;
    }
  }
  // Weekends, no meal allowance
  return 0;
};

export const calculateOvertimeAndMealAllowance = (
  records: AttendanceRecord[]
): OvertimeReport[] => {
  return records.map(record => {
    const overtimeHours = calculateOvertimeForRecord(record);
    const mealAllowance = calculateMealAllowanceForRecord(record);
    return {
      ...record,
      overtimeHours: parseFloat(overtimeHours.toFixed(2)), // Ensure two decimal places
      mealAllowance,
    };
  });
};

