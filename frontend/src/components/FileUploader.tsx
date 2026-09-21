/**
 * 檔案上傳組件
 *
 * 用途：處理出勤記錄檔案（CSV/TXT）的上傳與解析
 * 流程：
 * 1. 使用者選擇並上傳 CSV 或 TXT 檔案
 * 2. 根據檔案類型調用對應的解析器
 * 3. 驗證檔案格式與欄位內容
 * 4. 將解析後的記錄傳遞給父組件（可選擇同時寫入伺服器）
 * 5. 顯示錯誤訊息（若解析失敗）
 */

import React, { useId, useState } from 'react';
import Papa from 'papaparse';
import { parseTxtContent } from '../services/txtParser';
import type { AttendanceRecord } from '../types';

export type FileProcessedOptions = {
  /** 是否在本機解析成功後嘗試寫入伺服器台帳 */
  alsoImportToServer: boolean;
  /** 原始 File（寫入伺服器時用）；解析失敗或移除時為 null */
  file: File | null;
};

/**
 * FileUploader 組件的 Props 介面
 */
interface FileUploaderProps {
  /** 檔案處理完成後的回呼函數 */
  onFileProcessed: (
    records: AttendanceRecord[],
    rawTxtContent: string,
    fileType: 'txt' | 'csv',
    options: FileProcessedOptions
  ) => void;
  /** 全域班表 */
  globalShift: 'company' | 'warehouse';
  /** 全域班表變更回呼函數 */
  onGlobalShiftChange: (shift: 'company' | 'warehouse') => void;
}

/**
 * FileUploader 組件
 * @param {FileUploaderProps} props - 組件屬性
 * @returns {JSX.Element} 檔案上傳組件
 */
const FileUploader: React.FC<FileUploaderProps> = ({
  onFileProcessed,
  globalShift,
  onGlobalShiftChange,
}) => {
  const syncCheckboxId = useId();
  /** 錯誤訊息狀態 */
  const [error, setError] = useState<string | null>(null);

  /** 目前上傳的檔案 */
  const [file, setFile] = useState<File | null>(null);

  /** 檔案處理中狀態 */
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  /** 同時寫入伺服器（預設勾選，見 PRD §5.6.1） */
  const [alsoImportToServer, setAlsoImportToServer] = useState(true);

  /**
   * 處理 CSV 檔案解析
   * @param {File} file - CSV 檔案物件
   */
  const handleCsvFile = (uploaded: File) => {
    Papa.parse(uploaded, {
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const expectedHeaders = [
            '員工編號',
            '姓名',
            '歸屬日期',
            '考勤別',
            '數量',
            '上班時間',
            '下班時間',
          ];
          const actualHeaders = (results.data[0] as string[]) || [];

          if (
            actualHeaders.length !== expectedHeaders.length ||
            !expectedHeaders.every((header, index) => header === actualHeaders[index])
          ) {
            setError(
              'CSV 檔案格式不正確，請確認標頭是否符合「員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間」的順序。'
            );
            onFileProcessed([], '', 'csv', {
              alsoImportToServer: false,
              file: null,
            });
            setIsProcessing(false);
            return;
          }

          const allowedAttendanceTypes = [
            '事假',
            '病假',
            '請年休假',
            '公假',
            '空',
            '',
          ];

          const parsedRecords = (results.data as string[][])
            .slice(1)
            .filter(
              (row: string[]) =>
                row.length === expectedHeaders.length &&
                row.some((cell) => cell.trim() !== '')
            )
            .map((row: string[]): AttendanceRecord | null => {
              const attendanceType = row[3] || '空';

              if (!allowedAttendanceTypes.includes(attendanceType)) {
                throw new Error(
                  `CSV 檔案中包含不合法的考勤別: ${attendanceType}。請確認考勤別為 ${allowedAttendanceTypes.filter((t) => t !== '').join(', ')} 之一。`,
                );
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

          const records = parsedRecords.filter(
            (record): record is AttendanceRecord => record !== null
          );

          onFileProcessed(records, '', 'csv', {
            alsoImportToServer,
            file: records.length > 0 ? uploaded : null,
          });
          setIsProcessing(false);
        } catch (err) {
          setError(`處理 CSV 檔案時發生錯誤: ${err}`);
          onFileProcessed([], '', 'csv', {
            alsoImportToServer: false,
            file: null,
          });
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setError(`讀取 CSV 檔案時發生錯誤: ${err.message}`);
        onFileProcessed([], '', 'csv', {
          alsoImportToServer: false,
          file: null,
        });
        setIsProcessing(false);
      },
    });
  };

  /**
   * 處理 TXT 檔案解析
   * @param {File} file - TXT 檔案物件
   */
  const handleTxtFile = async (uploaded: File) => {
    try {
      const content = await uploaded.text();
      const records = parseTxtContent(content);
      onFileProcessed(records, content, 'txt', {
        alsoImportToServer,
        file: records.length > 0 ? uploaded : null,
      });
      setIsProcessing(false);
    } catch (err) {
      setError(`處理 TXT 檔案時發生錯誤: ${err}`);
      onFileProcessed([], '', 'txt', {
        alsoImportToServer: false,
        file: null,
      });
      setIsProcessing(false);
    }
  };

  /**
   * 處理檔案上傳事件
   * @param {React.ChangeEvent<HTMLInputElement>} event - 檔案輸入變更事件
   */
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    const uploadedFile = event.target.files?.[0];

    if (!uploadedFile) {
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);

    const fileName = uploadedFile.name.toLowerCase();

    if (fileName.endsWith('.txt')) {
      await handleTxtFile(uploadedFile);
    } else if (fileName.endsWith('.csv')) {
      handleCsvFile(uploadedFile);
    } else {
      setError('請上傳 TXT 或 CSV 格式的檔案。');
      setFile(null);
      setIsProcessing(false);
      onFileProcessed([], '', 'csv', {
        alsoImportToServer: false,
        file: null,
      });
    }
  };

  /**
   * 移除已上傳的檔案並重置狀態
   */
  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    onFileProcessed([], '', 'csv', {
      alsoImportToServer: false,
      file: null,
    });
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
          data-testid="file-input"
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
          <>
            <button
              onClick={handleRemoveFile}
              style={{ marginLeft: '10px', padding: '10px 15px' }}
            >
              移除
            </button>
            <select
              value={globalShift}
              onChange={(e) =>
                onGlobalShiftChange(e.target.value as 'company' | 'warehouse')
              }
              style={{ marginLeft: '10px', padding: '10px' }}
              title="本機班表（除錯）。正式路徑請用伺服器派班＋computation-context。"
            >
              <option value="company">公司班</option>
              <option value="warehouse">倉庫班</option>
            </select>
          </>
        )}
        {isProcessing && <span style={{ marginLeft: '10px' }}>處理中...</span>}
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor={syncCheckboxId} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <input
            id={syncCheckboxId}
            type="checkbox"
            checked={alsoImportToServer}
            onChange={(e) => setAlsoImportToServer(e.target.checked)}
            data-testid="also-import-to-server"
            style={{ marginRight: '6px' }}
          />
          同時寫入伺服器（出勤台帳／年假；未登入會先導向登入）
        </label>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default FileUploader;
