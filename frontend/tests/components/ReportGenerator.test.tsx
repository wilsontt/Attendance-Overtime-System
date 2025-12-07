import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      overtimeHours: 1.0,
      mealAllowance: 0,
    },
  ];

  it('should render correctly', () => {
    render(<ReportGenerator reports={mockReports} />);
    expect(screen.getByText('下載 Excel')).toBeInTheDocument();
    expect(screen.getByText('下載 PDF')).toBeInTheDocument();
    expect(screen.getByText('列印報告')).toBeInTheDocument();
  });

  it('should call generateExcel when "下載 Excel" button is clicked', async () => {
    const { Workbook } = await import('exceljs');
    render(<ReportGenerator reports={mockReports} />);
    
    fireEvent.click(screen.getByText('下載 Excel'));
    
    expect(Workbook).toHaveBeenCalledTimes(1);
    // Further checks could be added to verify worksheet content, but mocking the lib is enough for unit test
  });

  it('should call generatePdf when "下載 PDF" button is clicked', async () => {
    const pdfMake = await import('pdfmake/build/pdfmake');
    render(<ReportGenerator reports={mockReports} />);
    
    fireEvent.click(screen.getByText('下載 PDF'));
    
    expect(pdfMake.default.createPdf).toHaveBeenCalledTimes(1);
    // Further checks could verify docDefinition content
  });

  it('should call printReport when "列印報告" button is clicked', () => {
    const mockPrint = vi.fn();
    const originalWindowOpen = window.open;
    const originalWindowFocus = window.focus;
    const originalWindowPrint = window.print;

    window.open = vi.fn(() => ({
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: mockPrint,
    })) as any;

    render(<ReportGenerator reports={mockReports} />);
    fireEvent.click(screen.getByText('列印報告'));

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(mockPrint).toHaveBeenCalledTimes(1);

    window.open = originalWindowOpen;
    window.focus = originalWindowFocus;
    window.print = originalWindowPrint;
  });
});
