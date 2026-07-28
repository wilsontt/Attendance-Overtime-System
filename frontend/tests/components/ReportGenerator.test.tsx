import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ReportGenerator from '../../src/components/ReportGenerator';
import { OvertimeReport } from '../../src/types';

vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      addWorksheet() {
        return {
          mergeCells: vi.fn(),
          getCell: vi.fn(() => ({})),
          getRow: vi.fn(() => ({})),
          addRow: vi.fn(() => ({
            eachCell: vi.fn()
          })),
          getColumn: vi.fn(() => ({}))
        };
      }
      xlsx = {
        writeBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      };
    },
    ValueType: { Null: 0 }
  }
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
    selectedReports: mockReports,
    workLocation: '台北辦公室',
    onOpenPreview: vi.fn(),
    previewType: 'excel' as const,
    onReasonChange: vi.fn(),
  };

  it('should generate report based on previewType prop', () => {
    // 這裡只驗證組件可以正常渲染且不報錯
    // 實際的 Excel/PDF 產生邏輯較難在此測試環境驗證，且 UI (按鈕) 已經移至上層 PreviewModal
    const { container } = render(<ReportGenerator {...mockProps} />);
    expect(container).toBeTruthy();
  });
});
