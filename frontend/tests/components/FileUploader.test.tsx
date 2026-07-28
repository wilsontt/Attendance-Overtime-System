import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import FileUploader from '../../src/components/FileUploader';
import Papa from 'papaparse';

// Mock papaparse to control its behavior during tests
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file, options) => {
      options.complete({
        data: [['員工編號', '姓名', '歸屬日期', '考勤別', '數量', '上班時間', '下班時間'], ['emp001', '黃琨峻', '1141001', '空', '0', '09:00', '18:00']]
      });
    }),
  },
}));

describe('FileUploader', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<FileUploader onFileProcessed={vi.fn()} />);
    expect(screen.getByText('上傳 TXT 或 CSV 檔案')).toBeTruthy();
  });

  it('should call onFileProcessed with parsed data when a file is uploaded', async () => {
    const mockOnFileProcessed = vi.fn();
    render(<FileUploader onFileProcessed={mockOnFileProcessed} />);

    const file = new File(['header1,header2\ndata1,data2'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnFileProcessed).toHaveBeenCalledTimes(1);
    });

    expect(mockOnFileProcessed).toHaveBeenCalledWith(
      [{ employeeId: 'emp001', name: '黃琨峻', date: '1141001', attendanceType: '', leaveQuantity: 0, clockIn: '09:00', clockOut: '18:00' }],
      '',
      'csv'
    );
  });
});
