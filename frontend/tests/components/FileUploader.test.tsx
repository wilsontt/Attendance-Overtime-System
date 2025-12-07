import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import FileUploader from '../../src/components/FileUploader';
import { useCSVReader } from 'react-papaparse';

// Mock react-papaparse to control its behavior during tests
vi.mock('react-papaparse', () => ({
  useCSVReader: () => ({
    CSVReader: ({ onUploadAccepted, config, children }: any) => {
      const mockGetRootProps = () => ({
        onClick: (e: React.MouseEvent) => {
          // Simulate file input change
          const file = new File(['header1,header2\ndata1,data2'], 'test.csv', { type: 'text/csv' });
          const mockResults = { data: [['員工編號', '姓名', '歸屬日期', '上班時間', '下班時間'], ['emp001', '黃琨峻', '22025-10-01', '09:00', '18:00']] };
          onUploadAccepted(mockResults);
        },
      });
      return children({ getRootProps: mockGetRootProps, acceptedFile: null, getUploadFile: vi.fn() });
    },
  }),
}));

describe('FileUploader', () => {
  it('should render correctly', () => {
    render(<FileUploader onFileProcessed={vi.fn()} />);
    expect(screen.getByText('上傳 CSV 檔案')).toBeInTheDocument();
  });

  it('should call onFileProcessed with parsed data when a file is uploaded', () => {
    const mockOnFileProcessed = vi.fn();
    render(<FileUploader onFileProcessed={mockOnFileProcessed} />);

    // Simulate clicking the upload button
    fireEvent.click(screen.getByText('上傳 CSV 檔案'));

    expect(mockOnFileProcessed).toHaveBeenCalledTimes(1);
    expect(mockOnFileProcessed).toHaveBeenCalledWith([
      { employeeId: 'emp001', name: '黃琨峻', date: '22025-10-01', clockIn: '09:00', clockOut: '18:00' },
    ]);
  });
});
