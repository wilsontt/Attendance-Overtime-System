import { describe, it, expect } from 'vitest';
import { calculateOvertimeAndMealAllowance } from '../../src/services/calculationService';
import { AttendanceRecord } from '../../src/types';

describe('calculateOvertimeAndMealAllowance', () => {
  it('should return an empty array for empty input', () => {
    expect(calculateOvertimeAndMealAllowance([])).toEqual([]);
  });

  // Helper function to create attendance records for testing
  const createRecord = (
    date: string,
    clockIn: string,
    clockOut: string,
    employeeId = 'emp001',
    name = '測試員工'
  ): AttendanceRecord => ({ employeeId, name, date, clockIn, clockOut });

  // Test cases for weekday overtime (Mon-Fri, 18:00 onwards) and meal allowance (>= 19:30)
  it('should calculate weekday overtime and meal allowance correctly', () => {
    // Weekday, ends before 19:30, no meal allowance
    let records = [createRecord('2025-10-06', '09:00', '19:00')]; // Monday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(1.0); // 18:00 to 19:00
    expect(result[0].mealAllowance).toBe(0);

    // Weekday, ends at 19:30, with meal allowance
    records = [createRecord('2025-10-07', '09:00', '19:30')]; // Tuesday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(1.5); // 18:00 to 19:30
    expect(result[0].mealAllowance).toBe(50);

    // Weekday, ends after 19:30, with meal allowance
    records = [createRecord('2025-10-08', '09:00', '20:00')]; // Wednesday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(2.0); // 18:00 to 20:00
    expect(result[0].mealAllowance).toBe(50);
  });

  // Test cases for weekend overtime (all hours are overtime) and no meal allowance
  it('should calculate weekend overtime correctly with no meal allowance', () => {
    // Saturday
    let records = [createRecord('2025-10-04', '09:00', '17:00')]; // Saturday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(8.0); // 09:00 to 17:00
    expect(result[0].mealAllowance).toBe(0);

    // Sunday
    records = [createRecord('2025-10-05', '10:00', '18:00')]; // Sunday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(8.0); // 10:00 to 18:00
    expect(result[0].mealAllowance).toBe(0);
  });

  // Test cases for no overtime
  it('should handle records with no overtime', () => {
    // Weekday, leaves before 18:00
    let records = [createRecord('2025-10-09', '09:00', '17:00')]; // Thursday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0);
    expect(result[0].mealAllowance).toBe(0);
  });

  // Test cases for invalid clock times or durations
  it('should handle invalid clock times gracefully', () => {
    // Clock out before clock in (invalid)
    let records = [createRecord('2025-10-10', '18:00', '09:00')]; // Friday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0); // Assuming 0 for invalid records
    expect(result[0].mealAllowance).toBe(0);

    // Missing clock out
    records = [createRecord('2025-10-13', '09:00', '')]; // Monday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0);
    expect(result[0].mealAllowance).toBe(0);
  });
});
