/**
 * 檔案上傳組件
 * 
 * 用途：處理出勤記錄檔案（CSV/TXT）的上傳與解析
 * 流程：
 * 1. 使用者選擇並上傳 CSV 或 TXT 檔案
 * 2. 根據檔案類型調用對應的解析器
 * 3. 驗證檔案格式與欄位內容
 * 4. 將解析後的記錄傳遞給父組件
 * 5. 顯示錯誤訊息（若解析失敗）
 */

import React, { useState } from 'react';
import Papa from 'papaparse';
import { parseTxtFile } from '../services/txtParser';
import type { AttendanceRecord } from '../types';

/**
 * FileUploader 組件的 Props 介面
 */
interface FileUploaderProps {
  /** 檔案處理完成後的回呼函數 */
  onFileProcessed: (records: AttendanceRecord[]) => void;
}

/**
 * FileUploader 組件
 * @param {FileUploaderProps} props - 組件屬性
 * @returns {JSX.Element} 檔案上傳組件
 */
const FileUploader: React.FC<FileUploaderProps> = ({ onFileProcessed }) => {
  /** 錯誤訊息狀態 */
  const [error, setError] = useState<string | null>(null);
  
  /** 目前上傳的檔案 */
  const [file, setFile] = useState<File | null>(null);
  
  /** 檔案處理中狀態 */
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  /**
   * 處理 CSV 檔案解析
   * @param {File} file - CSV 檔案物件
   */
  const handleCsvFile = (file: File) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        try {
          // Validate header (expected: 員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間)
          const expectedHeaders = ['員工編號', '姓名', '歸屬日期', '考勤別', '數量', '上班時間', '下班時間'];
          const actualHeaders = (results.data[0] as string[]) || [];

          if (actualHeaders.length !== expectedHeaders.length || 
              !expectedHeaders.every((header, index) => header === actualHeaders[index])) {
            setError('CSV 檔案格式不正確，請確認標頭是否符合「員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間」的順序。');
            onFileProcessed([]);
            setIsProcessing(false);
            return;
          }

          // 驗證考勤別的合法值
          const allowedAttendanceTypes = ['事假', '病假', '請年休假', '公假', '空', ''];

          const parsedRecords = (results.data as string[][])
            .slice(1) // Skip header row
            .filter((row: string[]) => row.length === expectedHeaders.length && row.some(cell => cell.trim() !== ''))
            .map((row: string[]): AttendanceRecord | null => {
              const attendanceType = row[3] || '空';
              
              if (!allowedAttendanceTypes.includes(attendanceType)) {
                setError(`CSV 檔案中包含不合法的考勤別: ${attendanceType}。請確認考勤別為 ${allowedAttendanceTypes.filter(t => t !== '').join(', ')} 之一。`);
                return null;
              }

              return {
                employeeId: row[0],
                name: row[1],
                date: row[2],
                attendanceType: attendanceType === '空' ? '' : attendanceType,
                leaveQuantity: parseFloat(row[4]) || 0,
                clockIn: row[5],
                clockOut: row[6],
              };
            });
          
          const records = parsedRecords.filter((record): record is AttendanceRecord => record !== null);
          
          onFileProcessed(records);
          setIsProcessing(false);
        } catch (err) {
          setError(`處理 CSV 檔案時發生錯誤: ${err}`);
          onFileProcessed([]);
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setError(`讀取 CSV 檔案時發生錯誤: ${err.message}`);
        onFileProcessed([]);
        setIsProcessing(false);
      }
    });
  };

  /**
   * 處理 TXT 檔案解析
   * @param {File} file - TXT 檔案物件
   */
  const handleTxtFile = async (file: File) => {
    try {
      const records = await parseTxtFile(file);
      onFileProcessed(records);
      setIsProcessing(false);
    } catch (err) {
      setError(`處理 TXT 檔案時發生錯誤: ${err}`);
      onFileProcessed([]);
      setIsProcessing(false);
    }
  };

  /**
   * 處理檔案上傳事件
   * @param {React.ChangeEvent<HTMLInputElement>} event - 檔案輸入變更事件
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const uploadedFile = event.target.files?.[0];
    
    if (!uploadedFile) {
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);

    // 根據檔案類型決定處理方式
    const fileName = uploadedFile.name.toLowerCase();
    
    if (fileName.endsWith('.txt')) {
      await handleTxtFile(uploadedFile);
    } else if (fileName.endsWith('.csv')) {
      handleCsvFile(uploadedFile);
    } else {
      setError('請上傳 TXT 或 CSV 格式的檔案。');
      setFile(null);
      setIsProcessing(false);
      onFileProcessed([]);
    }
  };

  /**
   * 移除已上傳的檔案並重置狀態
   */
  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    onFileProcessed([]);
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <input
          type="file"
          accept=".txt,.csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="file-upload-input"
        />
        <label htmlFor="file-upload-input">
          <button
            type="button"
            onClick={() => document.getElementById('file-upload-input')?.click()}
            style={{ padding: '10px 15px', cursor: 'pointer' }}
            disabled={isProcessing}
          >
            {file ? file.name : '上傳 TXT 或 CSV 檔案'}
          </button>
        </label>
        {file && !isProcessing && (
          <button
            onClick={handleRemoveFile}
            style={{ marginLeft: '10px', padding: '10px 15px' }}
          >
            移除
          </button>
        )}
        {isProcessing && <span style={{ marginLeft: '10px' }}>處理中...</span>}
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default FileUploader;
