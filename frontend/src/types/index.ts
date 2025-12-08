export interface Employee {
  id: string;
  name: string;
}

export interface AttendanceRecord {
  employeeId: string;
  name: string;
  date: string;
  attendanceType?: string;
  leaveQuantity?: number;
  clockIn: string;
  clockOut: string;
}

export interface OvertimeReport {
  employeeId: string;
  name: string;
  date: string;
  attendanceType?: string;
  leaveQuantity?: number;
  clockIn: string;
  clockOut: string;
  overtimeHours: number;
  mealAllowance: number;
  overtimeRange: string;
  overtimeReason: string;
  isHoliday?: boolean; // 用於標記是否為國定假日
}
