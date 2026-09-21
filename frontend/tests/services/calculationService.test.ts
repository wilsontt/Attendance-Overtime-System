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

  describe('平日（公司班 09:00-18:00）', () => {
    it('無加班（09:00-18:00）', () => {
      const records = [createRecord('2025-10-06', '09:00', '18:00')]; // Monday
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].overtimeHours).toBe(0);
      expect(result[0].mealAllowance).toBe(0);
      expect(result[0].segment).toBe('晚');
    });

    it('僅早段加班（06:20-18:00）', () => {
      const records = [createRecord('2025-10-06', '06:20', '18:00')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('早');
      expect(result[0].overtimeHours).toBe(2.5); // 06:20 to 09:00 = 2h 40m -> 2.5h
      expect(result[0].mealAllowance).toBe(0);
    });

    it('僅早段加班（06:37-18:00）', () => {
      const records = [createRecord('2025-10-06', '06:37', '18:00')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('早');
      expect(result[0].overtimeHours).toBe(2.0); // 06:37 to 09:00 = 2h 23m -> 2.0h
      expect(result[0].mealAllowance).toBe(0);
    });

    it('早段未達 30 分鐘（08:40-18:00）', () => {
      const records = [createRecord('2025-10-06', '08:40', '18:00')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].overtimeHours).toBe(0); // 08:40 -> 09:00 (向上) to 09:00 = 0h
    });

    it('僅晚段加班，無誤餐費（09:00-19:00）', () => {
      const records = [createRecord('2025-10-06', '09:00', '19:00')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('晚');
      expect(result[0].overtimeHours).toBe(1.0); // 18:00 to 19:00 = 1h
      expect(result[0].mealAllowance).toBe(0);
    });

    it('僅晚段加班，有誤餐費（09:00-19:30）', () => {
      const records = [createRecord('2025-10-06', '09:00', '19:30')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('晚');
      expect(result[0].overtimeHours).toBe(1.5); // 18:00 to 19:30 = 1.5h
      expect(result[0].mealAllowance).toBe(50);
    });

    it('早段與晚段皆有加班（06:37-20:00）', () => {
      const records = [createRecord('2025-10-06', '06:37', '20:00')];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(2);
      
      expect(result[0].segment).toBe('早');
      expect(result[0].overtimeHours).toBe(2.0);
      expect(result[0].mealAllowance).toBe(0);

      expect(result[1].segment).toBe('晚');
      expect(result[1].overtimeHours).toBe(2.0);
      expect(result[1].mealAllowance).toBe(50);
    });
  });

  describe('平日（倉庫班 08:00-17:00）', () => {
    it('僅早段加班（06:37-17:00）', () => {
      const records = [createRecord('2025-10-06', '06:37', '17:00')];
      const result = calculateOvertimeAndMealAllowance(records, {}, {}, 'warehouse');
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('早');
      expect(result[0].overtimeHours).toBe(1.0); // 06:37 -> 07:00 (向上) to 08:00 = 1h
      expect(result[0].mealAllowance).toBe(0);
    });

    it('早段未達 30 分鐘（07:40-17:00）', () => {
      const records = [createRecord('2025-10-06', '07:40', '17:00')];
      const result = calculateOvertimeAndMealAllowance(records, {}, {}, 'warehouse');
      expect(result).toHaveLength(1);
      expect(result[0].overtimeHours).toBe(0);
    });
  });

  describe('例假日', () => {
    it('非補班週六（08:00-17:00）', () => {
      const records = [createRecord('2025-10-04', '08:00', '17:00')]; // Saturday
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('假日全段');
      expect(result[0].overtimeHours).toBe(9.0);
      expect(result[0].mealAllowance).toBe(0);
    });

    it('強制平日（補班週六）', () => {
      const records = [createRecord('2025-10-04', '09:00', '19:30')]; // Saturday
      const result = calculateOvertimeAndMealAllowance(records, {}, { 'emp001__2025-10-04': true });
      expect(result).toHaveLength(1);
      expect(result[0].segment).toBe('晚');
      expect(result[0].overtimeHours).toBe(1.5);
      expect(result[0].mealAllowance).toBe(50);
    });
  });

  describe('全天請假', () => {
    it('leaveQuantity >= 1 時加班時數強制為 0（即使有打卡）', () => {
      const records: AttendanceRecord[] = [
        {
          employeeId: 'emp001',
          name: '測試員工',
          date: '2025-10-06',
          clockIn: '09:00',
          clockOut: '20:00',
          attendanceType: '請年休假',
          leaveQuantity: 1,
        },
      ];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].overtimeHours).toBe(0);
      expect(result[0].mealAllowance).toBe(0);
      expect(result[0].overtimeRange).toBe('');
      expect(result[0].overtimeReason).toBe('請請年休假');
    });

    it('部分請假 leaveQuantity < 1 仍可計算加班', () => {
      const records: AttendanceRecord[] = [
        {
          employeeId: 'emp001',
          name: '測試員工',
          date: '2025-10-06',
          clockIn: '09:00',
          clockOut: '19:30',
          attendanceType: '事假',
          leaveQuantity: 0.5,
        },
      ];
      const result = calculateOvertimeAndMealAllowance(records);
      expect(result).toHaveLength(1);
      expect(result[0].overtimeHours).toBe(1.5);
      expect(result[0].mealAllowance).toBe(50);
    });
  });
});
