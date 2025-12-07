import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttendanceTable from '../../src/components/AttendanceTable';
import { OvertimeReport } from '../../src/types';

describe('AttendanceTable', () => {
  const mockReports: OvertimeReport[] = [
    {
      employeeId: 'emp001',
      name: '黃琨峻',
      date: '2025-10-01',
      clockIn: '09:00',
      clockOut: '18:00',
      overtimeHours: 2.5,
      mealAllowance: 50,
    },
    {
      employeeId: 'emp002',
      name: '陳小華',
      date: '2025-10-02',
      clockIn: '09:00',
      clockOut: '17:00',
      overtimeHours: 0,
      mealAllowance: 0,
    },
  ];

  it('should render the table with correct headers', () => {
    render(<AttendanceTable reports={[]} />);
    expect(screen.getByText('員工編號')).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('日期')).toBeInTheDocument();
    expect(screen.getByText('上班時間')).toBeInTheDocument();
    expect(screen.getByText('下班時間')).toBeInTheDocument();
    expect(screen.getByText('加班時數')).toBeInTheDocument();
    expect(screen.getByText('誤餐費')).toBeInTheDocument();
  });

  it('should render reports correctly', () => {
    render(<AttendanceTable reports={mockReports} />);

    expect(screen.getByText('emp001')).toBeInTheDocument();
    expect(screen.getByText('黃琨峻')).toBeInTheDocument();
    expect(screen.getByText('2025-10-01')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    expect(screen.getByText('emp002')).toBeInTheDocument();
    expect(screen.getByText('陳小華')).toBeInTheDocument();
    expect(screen.getByText('2025-10-02')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // For overtimeHours and mealAllowance of emp002
  });

  it('should render an empty table when no reports are provided', () => {
    render(<AttendanceTable reports={[]} />);
    const rows = screen.queryAllByRole('row');
    // Expecting only the header row
    expect(rows.length).toBe(1);
  });
});

