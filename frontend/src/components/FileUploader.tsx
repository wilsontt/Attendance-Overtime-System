import React, { useState } from 'react';
import { useCSVReader } from 'react-papaparse';
import type { AttendanceRecord } from '../types';

interface FileUploaderProps {
  onFileProcessed: (records: AttendanceRecord[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileProcessed }) => {
  const { CSVReader } = useCSVReader();
  const [error, setError] = useState<string | null>(null);

  const handleFileRead = (results: any, file: File) => {
    setError(null); // Clear previous errors
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('請上傳 CSV 格式的檔案。');
      onFileProcessed([]);
      return;
    }

    // Validate header (expected: 員工編號,姓名,歸屬日期,上班時間,下班時間)
    const expectedHeaders = ['員工編號', '姓名', '歸屬日期', '上班時間', '下班時間'];
    const actualHeaders = results.data[0] || [];

    if (actualHeaders.length !== expectedHeaders.length || 
        !expectedHeaders.every((header, index) => header === actualHeaders[index])) {
      setError('CSV 檔案格式不正確，請確認標頭是否符合「員工編號,姓名,歸屬日期,上班時間,下班時間」的順序。');
      onFileProcessed([]); // Clear any previous data
      return;
    }

    const records: AttendanceRecord[] = results.data
      .slice(1) // Skip header row
      .filter((row: string[]) => row.length === expectedHeaders.length && row.some(cell => cell.trim() !== '')) // Filter out empty or malformed rows
      .map((row: string[]) => ({
        employeeId: row[0],
        name: row[1],
        date: row[2],
        clockIn: row[3],
        clockOut: row[4],
      }));
    onFileProcessed(records);
  };

  const handleError = (err: any) => {
    setError(`讀取檔案時發生錯誤: ${err.message}`);
    onFileProcessed([]); // Clear any previous data
  }

  return (
    <div>
      <CSVReader onUploadAccepted={handleFileRead} onError={handleError} config={{ skipEmptyLines: true, header: false }}>
        {({ getRootProps, acceptedFile, getRemoveFileProps, ProgressBar }: { getRootProps: any, acceptedFile: any, getRemoveFileProps: any, ProgressBar: any }) => (
          <>
            <button type='button' {...getRootProps()}>
              {acceptedFile ? acceptedFile.name : '上傳 CSV 檔案'}
            </button>
            {acceptedFile && (
                <button {...getRemoveFileProps()}>
                    移除
                </button>
            )}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ProgressBar />
          </>
        )}
      </CSVReader>
    </div>
  );
};

export default FileUploader;
