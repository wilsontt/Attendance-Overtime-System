/**
 * 首頁組件
 *
 * 這個頁面是前端流程編排中心，主要負責：
 * 1. 接收檔案上傳後的原始出勤資料
 * 2. 呼叫計算服務轉成可展示、可匯出的加班報表
 * 3. 提供姓名與日期篩選
 * 4. 維護表格編輯狀態與預覽 Modal 開關
 * 5. 將使用者最後確認的資料交給匯出服務
 */

import React, { useState, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import { TopTitleNav } from '../components/TopTitleNav';
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
  
  /** 使用者於主列表編輯的加班原因（key: `${employeeId}__${date}`） */
  const [reasonOverrides, setReasonOverrides] = useState<Record<string, string>>({});

  /** 依出勤記錄計算出的加班報表（衍生狀態，不用 effect） */
  const calculatedReports = useMemo(
    () =>
      attendanceRecords.length > 0
        ? calculateOvertimeAndMealAllowance(attendanceRecords)
        : [],
    [attendanceRecords]
  );

  /** 合併計算結果與使用者編輯的加班原因 */
  const overtimeReports = useMemo(
    () =>
      calculatedReports.map((report) => {
        const key = `${report.employeeId}__${report.date}`;
        const override = reasonOverrides[key];
        return override !== undefined ? { ...report, overtimeReason: override } : report;
      }),
    [calculatedReports, reasonOverrides]
  );

  /** 姓名篩選條件 */
  const [filterName, setFilterName] = useState<string>('');
  
  /** 開始日期篩選條件 */
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  
  /** 結束日期篩選條件 */
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  /** 預覽 Modal 開關狀態 */
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  /** 原始 TXT 內容（供列印原始資料使用） */
  const [rawTxtContent, setRawTxtContent] = useState<string>('');

  /**
   * 「加到例假日加班」強制標記（key: `${employeeId}__${date}`，value: 是否強制列為例假日）。
   * 適用於國定假日落在平日（如勞動節落在週五）但有加班，需以例假日全日規則申報。
   * 由主列表與預覽 Modal 共用並雙向同步。
   */
  const [holidayOverrides, setHolidayOverrides] = useState<Record<string, boolean>>({});

  /**
   * 「加到平日加班」強制標記（key: `${employeeId}__${date}`，value: 是否強制列為平日）。
   * 適用於補班日落在週末（如補班日落在週六）但有加班，需以平日 18:00 起算規則申報。
   * 由主列表與預覽 Modal 共用並雙向同步。
   */
  const [weekdayOverrides, setWeekdayOverrides] = useState<Record<string, boolean>>({});

  /**
   * 處理檔案上傳完成事件
   * @param {AttendanceRecord[]} records - 解析後的出勤記錄陣列
   */
  const handleFileProcessed = (
    records: AttendanceRecord[],
    uploadedRawTxtContent: string,
    fileType: 'txt' | 'csv'
  ) => {
    setAttendanceRecords(records);
    setReasonOverrides({});
    setHolidayOverrides({});
    setWeekdayOverrides({});
    setRawTxtContent(fileType === 'txt' ? uploadedRawTxtContent : '');
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
    // 表格顯示的是 filteredReports，因此先找出畫面上那筆資料，再回寫原始報表狀態。
    const targetReport = filteredReports[index];
    if (!targetReport) return;

    const key = `${targetReport.employeeId}__${targetReport.date}`;
    setReasonOverrides(prev => ({ ...prev, [key]: newReason }));
  };

  /**
   * 切換「加到例假日加班」強制標記（主列表與預覽 Modal 雙向同步使用）
   * @param {string} employeeId - 員工編號
   * @param {string} date - 歸屬日期
   */
  const handleToggleHolidayOverride = (employeeId: string, date: string) => {
    const key = `${employeeId}__${date}`;
    setHolidayOverrides(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * 切換「加到平日加班」強制標記（補班日落在週末用；主列表與預覽 Modal 雙向同步）
   * @param {string} employeeId - 員工編號
   * @param {string} date - 歸屬日期
   */
  const handleToggleWeekdayOverride = (employeeId: string, date: string) => {
    const key = `${employeeId}__${date}`;
    setWeekdayOverrides(prev => ({ ...prev, [key]: !prev[key] }));
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
   * @param {string} weekdayWorkLocation - 平日加班工作地點
   * @param {string} weekdayRemarks - 平日加班備註
   * @param {string} holidayWorkLocation - 例假日加班工作地點
   * @param {string} holidayRemarks - 例假日加班備註
   */
  const handleDownloadExcel = (
    weekdayReports: OvertimeReport[], 
    holidayReports: OvertimeReport[], 
    weekdayWorkLocation: string, 
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string
  ) => {
    generateExcelReport(weekdayReports, holidayReports, weekdayWorkLocation, weekdayRemarks, holidayWorkLocation, holidayRemarks);
    setIsPreviewModalOpen(false);
  };

  /**
   * 處理下載 PDF 事件
   * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
   * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
   * @param {string} weekdayWorkLocation - 平日加班工作地點
   * @param {string} weekdayRemarks - 平日加班備註
   * @param {string} holidayWorkLocation - 例假日加班工作地點
   * @param {string} holidayRemarks - 例假日加班備註
   */
  const handleDownloadPdf = async (
    weekdayReports: OvertimeReport[], 
    holidayReports: OvertimeReport[], 
    weekdayWorkLocation: string, 
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string
  ) => {
    await generatePdfReport(weekdayReports, holidayReports, weekdayWorkLocation, weekdayRemarks, holidayWorkLocation, holidayRemarks);
    setIsPreviewModalOpen(false);
  };

  /**
   * 處理列印事件
   * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
   * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
   * @param {string} weekdayWorkLocation - 平日加班工作地點
   * @param {string} weekdayRemarks - 平日加班備註
   * @param {string} holidayWorkLocation - 例假日加班工作地點
   * @param {string} holidayRemarks - 例假日加班備註
   */
  const handlePrint = (
    weekdayReports: OvertimeReport[], 
    holidayReports: OvertimeReport[], 
    weekdayWorkLocation: string, 
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string
  ) => {
    printReport(weekdayReports, holidayReports, weekdayWorkLocation, weekdayRemarks, holidayWorkLocation, holidayRemarks);
    setIsPreviewModalOpen(false);
  };

  return (
    <div className="relative">
      <div className="mb-5 -mx-4 sm:-mx-5">
        <TopTitleNav />
      </div>
      <FileUploader onFileProcessed={handleFileProcessed} />

      {overtimeReports.length > 0 && (
        <>
          {/* 篩選只影響畫面與預覽名單，不會改動原始上傳資料。 */}
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
          <AttendanceTable
            reports={filteredReports}
            onReasonChange={handleReasonChange}
            holidayOverrides={holidayOverrides}
            onToggleHolidayOverride={handleToggleHolidayOverride}
            weekdayOverrides={weekdayOverrides}
            onToggleWeekdayOverride={handleToggleWeekdayOverride}
          />
          
          {/* 所有匯出入口都先進入預覽 Modal，避免直接下載錯誤資料。 */}
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
            rawTxtContent={rawTxtContent}
            holidayOverrides={holidayOverrides}
            onToggleHolidayOverride={handleToggleHolidayOverride}
            weekdayOverrides={weekdayOverrides}
            onToggleWeekdayOverride={handleToggleWeekdayOverride}
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
