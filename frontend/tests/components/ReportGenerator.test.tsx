import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ReportGenerator from '../../src/components/ReportGenerator';
import { OvertimeReport } from '../../src/types';

// Mock exceljs and pdfmake to prevent actual file operations during tests
vi.mock('exceljs', () => ({
  Workbook: vi.fn(() => ({
    addWorksheet: vi.fn(),
    xlsx: {
      writeBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    },
  })),
}));

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    createPdf: vi.fn(() => ({
      download: vi.fn(),
    })),
    vfs: {},
    fonts: {},
  },
}));

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { pdfMake: { vfs: {} } },
}));

describe('ReportGenerator', () => {
  const mockReports: OvertimeReport[] = [
    {
      employeeId: 'emp001',
      name: '測試員工',
      date: '2025-10-01',
      clockIn: '09:00',
      clockOut: '19:00',
      originalClockIn: '09:00',
      originalClockOut: '19:00',
      overtimeHours: 1.0,
      mealAllowance: 0,
      overtimeRange: '',
      overtimeReason: '',
    },
  ];

  afterEach(() => {
    cleanup();
  });

  const mockProps = {
    reports: mockReports,
    onOpenPreview: vi.fn(),
    previewType: 'excel' as const,
    onReasonChange: vi.fn(),
  };

  it('should render correctly', () => {
    render(<ReportGenerator {...mockProps} />);
    expect(screen.getByText('下載 Excel')).toBeTruthy();
  });

  it('should call onOpenPreview with excel when "下載 Excel" button is clicked', () => {
    const onOpenPreview = vi.fn();
    render(<ReportGenerator {...mockProps} onOpenPreview={onOpenPreview} />);
    
    fireEvent.click(screen.getByText('下載 Excel'));
    
    expect(onOpenPreview).toHaveBeenCalledWith('excel');
  });

  it('should call onOpenPreview with pdf when "下載 PDF" button is clicked', () => {
    const onOpenPreview = vi.fn();
    render(<ReportGenerator {...mockProps} onOpenPreview={onOpenPreview} />);
    
    fireEvent.click(screen.getByText('下載 PDF'));
    
    expect(onOpenPreview).toHaveBeenCalledWith('pdf');
  });

  it('should call onOpenPreview with print when "列印報告" button is clicked', () => {
    const onOpenPreview = vi.fn();
    render(<ReportGenerator {...mockProps} onOpenPreview={onOpenPreview} />);

    fireEvent.click(screen.getByText('列印報告'));

    expect(onOpenPreview).toHaveBeenCalledWith('print');
  });
});
