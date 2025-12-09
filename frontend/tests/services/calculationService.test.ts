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

  // Test cases for new rule: overtime < 30 minutes should not be calculated
  it('should not calculate overtime if less than 30 minutes', () => {
    // Weekday: 18:00 to 18:25 (25 minutes) -> should return 0
    let records = [createRecord('2025-10-06', '09:00', '18:25')]; // Monday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0);
    expect(result[0].mealAllowance).toBe(0);

    // Weekday: 18:00 to 18:29 (29 minutes) -> should return 0
    records = [createRecord('2025-10-07', '09:00', '18:29')]; // Tuesday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0);
    expect(result[0].mealAllowance).toBe(0);
  });

  // Test cases for rounding to 0.5 hour units when >= 30 minutes
  it('should round overtime to 0.5 hour units when >= 30 minutes', () => {
    // Weekday: 18:00 to 18:45 (45 minutes) -> should round to 0.5 hours
    let records = [createRecord('2025-10-06', '09:00', '18:45')]; // Monday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0.5); // 45 minutes rounds down to 0.5 hours
    expect(result[0].mealAllowance).toBe(0);

    // Weekday: 18:00 to 19:15 (1 hour 15 minutes) -> should round to 1.0 hours
    records = [createRecord('2025-10-07', '09:00', '19:15')]; // Tuesday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(1.0); // 1 hour 15 minutes rounds down to 1.0 hours
    expect(result[0].mealAllowance).toBe(0);

    // Weekday: 18:00 to 19:45 (1 hour 45 minutes) -> should round to 1.5 hours
    records = [createRecord('2025-10-08', '09:00', '19:45')]; // Wednesday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(1.5); // 1 hour 45 minutes rounds down to 1.5 hours
    expect(result[0].mealAllowance).toBe(50); // >= 19:30, so meal allowance
  });

  // Test cases for weekend/holiday: same rule applies
  it('should apply same rule (< 30 minutes = 0) for weekend/holiday', () => {
    // Saturday: 08:56 to 09:20 (24 minutes after alignment: 09:00 to 09:00) -> should return 0
    // Actually, after alignment: 09:00 to 09:00 = 0 minutes -> should return 0
    let records = [createRecord('2025-10-04', '08:56', '09:20')]; // Saturday
    let result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0); // After alignment, less than 30 minutes
    expect(result[0].mealAllowance).toBe(0);

    // Saturday: 08:56 to 09:45 (after alignment: 09:00 to 09:30 = 30 minutes) -> should return 0.5
    records = [createRecord('2025-10-04', '08:56', '09:45')]; // Saturday
    result = calculateOvertimeAndMealAllowance(records);
    expect(result[0].overtimeHours).toBe(0.5); // After alignment: 09:00 to 09:30 = 30 minutes = 0.5 hours
    expect(result[0].mealAllowance).toBe(0);
  });
});
