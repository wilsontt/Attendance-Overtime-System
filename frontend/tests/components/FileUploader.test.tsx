import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import FileUploader from '../../src/components/FileUploader';

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((_file, options) => {
      options.complete({
        data: [
          ['員工編號', '姓名', '歸屬日期', '考勤別', '數量', '上班時間', '下班時間'],
          ['emp001', '黃琨峻', '1141001', '空', '0', '09:00', '18:00'],
        ],
      });
    }),
  },
}));

describe('FileUploader', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    globalShift: 'company' as const,
    onGlobalShiftChange: vi.fn(),
  };

  it('should render correctly', () => {
    render(<FileUploader onFileProcessed={vi.fn()} {...defaultProps} />);
    expect(screen.getByText('上傳 TXT 或 CSV 檔案')).toBeTruthy();
    expect(
      (screen.getByTestId('also-import-to-server') as HTMLInputElement).checked
    ).toBe(true);
  });

  it('should call onFileProcessed with parsed data when a file is uploaded', async () => {
    const mockOnFileProcessed = vi.fn();
    render(
      <FileUploader onFileProcessed={mockOnFileProcessed} {...defaultProps} />
    );

    const file = new File(['header1,header2\ndata1,data2'], 'test.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mockOnFileProcessed).toHaveBeenCalledTimes(1);
    });

    expect(mockOnFileProcessed).toHaveBeenCalledWith(
      [
        {
          employeeId: 'emp001',
          name: '黃琨峻',
          date: '1141001',
          attendanceType: '',
          leaveQuantity: 0,
          clockIn: '09:00',
          clockOut: '18:00',
        },
      ],
      '',
      'csv',
      expect.objectContaining({
        alsoImportToServer: true,
        file: expect.any(File),
      })
    );
  });

  it('should pass alsoImportToServer false when checkbox unchecked', async () => {
    const mockOnFileProcessed = vi.fn();
    render(
      <FileUploader onFileProcessed={mockOnFileProcessed} {...defaultProps} />
    );

    fireEvent.click(screen.getByTestId('also-import-to-server'));

    const file = new File(['x'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mockOnFileProcessed).toHaveBeenCalledTimes(1);
    });

    expect(mockOnFileProcessed.mock.calls[0][3]).toEqual(
      expect.objectContaining({ alsoImportToServer: false })
    );
  });
});
