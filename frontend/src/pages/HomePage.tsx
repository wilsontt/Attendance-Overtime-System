/**
 * 首頁組件
 * 
 * 用途：出勤加班單系統的主要頁面，整合檔案上傳、資料顯示、篩選與報表產生功能
 * 流程：
 * 1. 使用者上傳 CSV/TXT 檔案
 * 2. 解析檔案並自動計算加班時數與誤餐費
 * 3. 顯示計算結果於表格中
 * 4. 提供篩選功能（按姓名、日期範圍）
 * 5. 使用者可編輯加班原因
 * 6. 點擊下載按鈕開啟預覽 Modal
 * 7. 在 Modal 中選擇記錄並下載 Excel/PDF 或列印
 */

import React, { useState, useEffect, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import AttendanceTable from '../components/AttendanceTable';
import PreviewModal from '../components/PreviewModal';
import type { AttendanceRecord, OvertimeReport } from '../types';
import { calculateOvertimeAndMealAllowance } from '../services/calculationService';
import { generateExcelReport, generatePdfReport, printReport } from '../services/reportService';

/**
 * HomePage 組件
 * @returns {JSX.Element} 首頁組件
 */
const HomePage: React.FC = () => {
  /** 原始出勤記錄（從檔案解析而來） */
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  
  /** 加班報表（計算後的結果） */
  const [overtimeReports, setOvertimeReports] = useState<OvertimeReport[]>([]);
  
  /** 姓名篩選條件 */
  const [filterName, setFilterName] = useState<string>('');
  
  /** 開始日期篩選條件 */
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  
  /** 結束日期篩選條件 */
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  /** 預覽 Modal 開關狀態 */
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  /**
   * 當出勤記錄變更時，自動計算加班時數與誤餐費
   */
  useEffect(() => {
    if (attendanceRecords.length > 0) {
      const reports = calculateOvertimeAndMealAllowance(attendanceRecords);
      setOvertimeReports(reports);
    } else {
      setOvertimeReports([]);
    }
  }, [attendanceRecords]);

  /**
   * 處理檔案上傳完成事件
   * @param {AttendanceRecord[]} records - 解析後的出勤記錄陣列
   */
  const handleFileProcessed = (records: AttendanceRecord[]) => {
    setAttendanceRecords(records);
  };

  /**
   * 根據篩選條件過濾加班報表
   * @returns {OvertimeReport[]} 過濾後的報表陣列
   */
  const filteredReports = useMemo(() => {
    return overtimeReports.filter(report => {
      const matchesName = filterName ? report.name.includes(filterName) : true;
      
      const reportDate = new Date(report.date);
      const matchesStartDate = filterStartDate ? reportDate >= new Date(filterStartDate) : true;
      const matchesEndDate = filterEndDate ? reportDate <= new Date(filterEndDate) : true;

      return matchesName && matchesStartDate && matchesEndDate;
    });
  }, [overtimeReports, filterName, filterStartDate, filterEndDate]);

  /**
   * 處理加班原因編輯事件
   * @param {number} index - 在過濾後報表中的索引
   * @param {string} newReason - 新的加班原因
   */
  const handleReasonChange = (index: number, newReason: string) => {
    const targetReport = filteredReports[index];
    if (!targetReport) return;

    setOvertimeReports(prev => prev.map(report => {
      if (report.employeeId === targetReport.employeeId && report.date === targetReport.date) {
        return { ...report, overtimeReason: newReason };
      }
      return report;
    }));
  };

  /**
   * 開啟預覽 Modal
   */
  const handleOpenPreview = () => {
    setIsPreviewModalOpen(true);
  };

  /**
   * 關閉預覽 Modal
   */
  const handleClosePreview = () => {
    setIsPreviewModalOpen(false);
  };

  /**
   * 處理下載 Excel 事件
   * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
   * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
   * @param {string} workLocation - 工作地點
   * @param {string} remarks - 備註
   */
  const handleDownloadExcel = (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string, remarks: string) => {
    generateExcelReport(weekdayReports, holidayReports, workLocation, remarks);
    setIsPreviewModalOpen(false);
  };

  /**
   * 處理下載 PDF 事件
   * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
   * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
   * @param {string} workLocation - 工作地點
   * @param {string} remarks - 備註
   */
  const handleDownloadPdf = async (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string, remarks: string) => {
    await generatePdfReport(weekdayReports, holidayReports, workLocation, remarks);
    setIsPreviewModalOpen(false);
  };

  /**
   * 處理列印事件
   * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
   * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
   * @param {string} workLocation - 工作地點
   * @param {string} remarks - 備註
   */
  const handlePrint = (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string, remarks: string) => {
    printReport(weekdayReports, holidayReports, workLocation, remarks);
    setIsPreviewModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
        <img 
          src="/logo.png" 
          alt="Company Logo" 
          style={{ height: '60px', marginRight: '15px' }} 
        />
        <h1 style={{ margin: 0 }}>出勤加班單系統 v1.3.0</h1>
      </div>
      <FileUploader onFileProcessed={handleFileProcessed} />

      {overtimeReports.length > 0 && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="按姓名篩選"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              style={{ marginRight: '10px', padding: '8px' }}
            />
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ marginRight: '5px', padding: '8px' }}
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ padding: '8px' }}
            />
          </div>
          <AttendanceTable reports={filteredReports} onReasonChange={handleReasonChange} />
          
          {/* 單一下載按鈕 */}
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={handleOpenPreview} 
              style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
            >
              下載
            </button>
          </div>

          <PreviewModal
            reports={filteredReports}
            isOpen={isPreviewModalOpen}
            onClose={handleClosePreview}
            onDownloadExcel={handleDownloadExcel}
            onDownloadPdf={handleDownloadPdf}
            onPrint={handlePrint}
          />
        </>
      )}
    </div>
  );
};

export default HomePage;
