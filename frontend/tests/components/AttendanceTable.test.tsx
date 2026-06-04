import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AttendanceTable from '../../src/components/AttendanceTable';
import { OvertimeReport } from '../../src/types';

describe('AttendanceTable', () => {
  // 專案未設定 vitest 全域 auto-cleanup，這裡明確清理避免跨測試 DOM 殘留
  afterEach(() => cleanup());

  const mockReports: OvertimeReport[] = [
    {
      employeeId: 'emp001',
      name: '黃琨峻',
      date: '2025-10-01',
      clockIn: '09:00',
      clockOut: '18:00',
      overtimeHours: 2.5,
      mealAllowance: 50,
      overtimeRange: '18:00 - 18:00',
      overtimeReason: '',
    },
    {
      employeeId: 'emp002',
      name: '陳小華',
      date: '2025-10-02',
      clockIn: '09:00',
      clockOut: '17:00',
      overtimeHours: 0,
      mealAllowance: 0,
      overtimeRange: '',
      overtimeReason: '',
    },
  ];

  /** 共用必填 props（覆寫標記與回呼），各測試以 reports 覆蓋 */
  const baseProps = {
    onReasonChange: vi.fn(),
    holidayOverrides: {},
    onToggleHolidayOverride: vi.fn(),
    weekdayOverrides: {},
    onToggleWeekdayOverride: vi.fn(),
  };

  it('should render the table with correct headers', () => {
    render(<AttendanceTable reports={[]} {...baseProps} />);
    // 使用 getByText（找不到即拋錯）搭配原生斷言，避免依賴未設定的 jest-dom matcher
    expect(screen.getByText('員工編號')).toBeTruthy();
    expect(screen.getByText('姓名')).toBeTruthy();
    expect(screen.getByText('日期')).toBeTruthy();
    expect(screen.getByText('上班時間')).toBeTruthy();
    expect(screen.getByText('下班時間')).toBeTruthy();
    expect(screen.getByText('加班時數')).toBeTruthy();
    expect(screen.getByText('誤餐費')).toBeTruthy();
    expect(screen.getByText('加到例假日加班')).toBeTruthy();
    expect(screen.getByText('加到平日加班')).toBeTruthy();
  });

  it('should render reports correctly', () => {
    render(<AttendanceTable reports={mockReports} {...baseProps} />);

    expect(screen.getByText('emp001')).toBeTruthy();
    expect(screen.getByText('黃琨峻')).toBeTruthy();
    expect(screen.getByText('2025/10/01 週三')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('2.50')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();

    expect(screen.getByText('emp002')).toBeTruthy();
    expect(screen.getByText('陳小華')).toBeTruthy();
    expect(screen.getByText('2025/10/02 週四')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
  });

  it('should render an empty table when no reports are provided', () => {
    render(<AttendanceTable reports={[]} {...baseProps} />);
    const rows = screen.queryAllByRole('row');
    // Expecting only the header row
    expect(rows.length).toBe(1);
  });
});

