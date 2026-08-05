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
import { calculateOvertimeAndMealAllowance, isNaturalHoliday } from '../services/calculationService';
import { generateExcelReport, generatePdfReport, printReport } from '../services/reportService';
import { formatDate } from '../utils/dateFormatter';

/**
 * HomePage 組件
 * @returns {JSX.Element} 首頁組件
 */
const HomePage: React.FC = () => {
  /** 原始出勤記錄（從檔案解析而來） */
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  
  /** 使用者於主列表編輯的加班原因（key: `${employeeId}__${date}`） */
  const [reasonOverrides, setReasonOverrides] = useState<Record<string, string>>({});

  /** 忘記打卡補登狀態（key: `${employeeId}__${date}`） */
  const [punchOverrides, setPunchOverrides] = useState<Record<string, { clockIn?: string, clockOut?: string, reason?: string }>>({});

  /** 處理忘記打卡時間與理由補登 */
  const handlePunchOverride = (employeeId: string, date: string, field: 'clockIn' | 'clockOut' | 'reason', value: string) => {
    const key = `${employeeId}__${date}`;
    setPunchOverrides(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  /** 合併原始記錄與使用者補登的上下班時間 */
  const recordsWithPunchOverrides = useMemo(() => {
    return attendanceRecords.map((record) => {
      const key = `${record.employeeId}__${record.date}`;
      const override = punchOverrides[key];
      return {
        ...record,
        originalClockIn: record.clockIn,
        originalClockOut: record.clockOut,
        clockIn: override?.clockIn || record.clockIn,
        clockOut: override?.clockOut || record.clockOut,
      };
    });
  }, [attendanceRecords, punchOverrides]);

  /** 依出勤記錄計算出的加班報表（衍生狀態，不用 effect） */
  const calculatedReports = useMemo(
    () =>
      recordsWithPunchOverrides.length > 0
        ? calculateOvertimeAndMealAllowance(recordsWithPunchOverrides)
        : [],
    [recordsWithPunchOverrides]
  );

  /** 合併計算結果與使用者編輯的加班原因 */
  const overtimeReports = useMemo(
    () =>
      calculatedReports.map((report) => {
        const key = `${report.employeeId}__${report.date}`;
        const overrideReason = reasonOverrides[key];
        
        const finalReason = overrideReason !== undefined ? overrideReason : report.overtimeReason;
        // 如果原本是空白，不自動幫忙填寫 "忘記打卡補登"
        // 使用者仍須手動在「加班原因」欄位輸入
        
        return { ...report, overtimeReason: finalReason };
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
    setPunchOverrides({});
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

  /** 彙整忘記打卡理由作為預設備註 */
  const { defaultWeekdayRemarks, defaultHolidayRemarks } = useMemo(() => {
    let weekday = '';
    let holiday = '';
    Object.entries(punchOverrides).forEach(([key, override]) => {
      if (override.reason?.trim()) {
        const [, date] = key.split('__');
        const isHoliday = holidayOverrides[key] || (!weekdayOverrides[key] && isNaturalHoliday(date));
        const text = `${formatDate(date).split(' ')[0]}補登：${override.reason}。 `;
        if (isHoliday) {
          holiday += text;
        } else {
          weekday += text;
        }
      }
    });
    return { defaultWeekdayRemarks: weekday, defaultHolidayRemarks: holiday };
  }, [punchOverrides, holidayOverrides, weekdayOverrides]);

  /**
   * 開啟預覽 Modal
   */
  const handleOpenPreview = () => {
    // 檢查是否有原始缺卡且「已開始補登但未完成」的記錄
    // 檢查是否有原始缺卡但「尚未補登完成」或「完全沒動」的記錄
    const incompletePunches = filteredReports.filter(report => {
      // 精確判斷：是否為「全天請假」 (大於等於 1 天)
      const isFullLeave = Boolean(
        report.attendanceType && 
        report.attendanceType !== '空' && 
        report.attendanceType !== '' &&
        report.leaveQuantity && 
        report.leaveQuantity >= 1
      );
      
      // 如果是全天請假，直接略過缺卡檢查
      if (isFullLeave) return false;

      const originallyMissingIn = !report.originalClockIn;
      const originallyMissingOut = !report.originalClockOut;
      
      if (originallyMissingIn || originallyMissingOut) {
        const key = `${report.employeeId}__${report.date}`;
        const override = punchOverrides[key];
        
        // 如果使用者有填寫任何一欄 (上班、下班、或理由)
        const hasStartedPunching = override && (override.clockIn || override.clockOut || override.reason?.trim());
        
        if (hasStartedPunching) {
          const hasClockIn = Boolean(report.originalClockIn || override.clockIn);
          const hasClockOut = Boolean(report.originalClockOut || override.clockOut);
          const hasReason = Boolean(override.reason?.trim());
          
          // 若已開始補登，但沒有全部填完，則視為未完成
          return !(hasClockIn && hasClockOut && hasReason);
        }
        
        // 如果連動都沒動，也是未完成
        return true;
      }
      return false;
    });

    if (incompletePunches.length > 0) {
      const errList = incompletePunches.map(r => ` - ${r.name} ${formatDate(r.date).split(' ')[0]}`).join('\n');
      alert(`您有缺卡記錄尚未補登完成！\n請確保缺卡記錄的「上班時間」、「下班時間」及「缺卡備註」皆已填寫。\n\n未完成名單：\n${errList}`);
      return;
    }

    // 檢查一般加班原因是否都有填寫 (包含補登後的記錄，如果有達到加班門檻)
    const missingOvertimeReasons = filteredReports.filter(report => {
      const isFullLeave = Boolean(
        report.attendanceType && 
        report.attendanceType !== '空' && 
        report.attendanceType !== '' &&
        report.leaveQuantity && 
        report.leaveQuantity >= 1
      );
      const isUnderThreshold = report.overtimeHours < 0.5;
      
      // 有完整打卡 (含補登)、非全天請假、達到門檻，就必須填寫加班原因
      if (report.clockIn && report.clockOut && !isFullLeave && !isUnderThreshold) {
        return !report.overtimeReason?.trim();
      }
      return false;
    });

    if (missingOvertimeReasons.length > 0) {
      const errList = missingOvertimeReasons.map(r => ` - ${r.name} ${formatDate(r.date).split(' ')[0]}`).join('\n');
      alert(`您有加班記錄尚未填寫「加班原因」！\n請確保所有符合加班條件的記錄都已填寫加班原因。\n\n未填寫名單：\n${errList}`);
      return;
    }

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
            punchOverrides={punchOverrides}
            onPunchOverride={handlePunchOverride}
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
            defaultWeekdayRemarks={defaultWeekdayRemarks}
            defaultHolidayRemarks={defaultHolidayRemarks}
          />
        </>
      )}
    </div>
  );
};

export default HomePage;
