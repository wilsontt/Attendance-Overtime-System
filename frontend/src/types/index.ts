export interface Employee {
  id: string;
  name: string;
}

export interface AttendanceRecord {
  employeeId: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string;
}

export interface OvertimeReport {
  employeeId: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string;
  overtimeHours: number;
  mealAllowance: number;
}
