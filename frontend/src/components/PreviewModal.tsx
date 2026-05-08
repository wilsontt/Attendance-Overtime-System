/**
 * 預覽 Modal 組件
 * 
 * 用途：提供加班申請表預覽、記錄選擇、國定假日標記與下載功能
 * 流程：
 * 1. 過濾有完整上下班刷卡時間的記錄
 * 2. 分離平日加班與例假日加班記錄
 * 3. 使用者可勾選要包含在申請表中的記錄
 * 4. 使用者可標記國定假日（影響加班時數計算）
 * 5. 使用者填寫工作地點與加班原因
 * 6. 驗證必填欄位後下載 Excel/PDF 或列印
 */

import React, { useState, useEffect } from 'react';
import type { OvertimeReport } from '../types';
import { recalculateOvertimeReport } from '../services/calculationService';
import {
  REPORT_REMARK_LINE_CHARS,
  REPORT_REMARK_LINES,
  REPORT_REMARK_MAX_CHARS,
  REPORT_WORK_LOCATION_MAX_CHARS
} from '../services/reportService';
import { formatDate } from '../utils/dateFormatter';
import './PreviewModal.css';

const OVERTIME_REASON_MAX_LENGTH = 200;
const PREVIEW_ITEMS_PER_PAGE = 15;
const REMARK_MAX_LENGTH = REPORT_REMARK_MAX_CHARS;
const REMARK_LINE_LENGTH = REPORT_REMARK_LINE_CHARS;
const REMARK_TOTAL_LINES = REPORT_REMARK_LINES;

function normalizeRemarkInput(input: string): string {
  const singleLine = input.replace(/\r?\n/g, '');
  return Array.from(singleLine).slice(0, REMARK_MAX_LENGTH).join('');
}

function normalizeWorkLocationInput(input: string): string {
  return Array.from(input.replace(/\r?\n/g, '')).slice(0, REPORT_WORK_LOCATION_MAX_CHARS).join('');
}

/**
 * PreviewModal 組件的 Props 介面
 */
interface PreviewModalProps {
  /** 加班報表陣列 */
  reports: OvertimeReport[];
  /** 原始 TXT 內容（僅 TXT 上傳時有值） */
  rawTxtContent: string;
  /** Modal 開關狀態 */
  isOpen: boolean;
  /** 關閉 Modal 回呼函數 */
  onClose: () => void;
  /** 下載 Excel 回呼函數 */
  onDownloadExcel: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], weekdayWorkLocation: string, weekdayRemarks: string, holidayWorkLocation: string, holidayRemarks: string) => void;
  /** 下載 PDF 回呼函數 */
  onDownloadPdf: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], weekdayWorkLocation: string, weekdayRemarks: string, holidayWorkLocation: string, holidayRemarks: string) => void;
  /** 列印回呼函數 */
  onPrint: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], weekdayWorkLocation: string, weekdayRemarks: string, holidayWorkLocation: string, holidayRemarks: string) => void;
}

/**
 * PreviewModal 組件
 * @param {PreviewModalProps} props - 組件屬性
 * @returns {JSX.Element | null} 預覽 Modal 組件
 */
const PreviewModal: React.FC<PreviewModalProps> = ({ 
  reports, 
  rawTxtContent,
  isOpen, 
  onClose, 
  onDownloadExcel,
  onDownloadPdf,
  onPrint
}) => {
  /** 過濾出有完整上下班刷卡時間的記錄 */
  const [filteredReports, setFilteredReports] = useState<OvertimeReport[]>([]);
  
  /** 平日加班工作地點 */
  const [workLocation, setWorkLocation] = useState<string>('');
  
  /** 平日加班備註 */
  const [remarks, setRemarks] = useState<string>('');
  
  /** 例假日加班工作地點 */
  const [holidayWorkLocation, setHolidayWorkLocation] = useState<string>('');
  
  /** 例假日加班備註 */
  const [holidayRemarks, setHolidayRemarks] = useState<string>('');
  
  /** 國定假日標記（key: date, value: isHoliday） */
  const [holidayFlags, setHolidayFlags] = useState<{ [key: string]: boolean }>({});
  
  /** 記錄選擇狀態（key: index, value: isSelected） */
  const [recordSelection, setRecordSelection] = useState<{ [key: number]: boolean }>({});

  /** 加班原因編輯狀態（key: index, value: reason） */
  const [editedReasons, setEditedReasons] = useState<{ [key: number]: string }>({});

  /**
   * 當 Modal 開啟時，初始化狀態
   */
  useEffect(() => {
    if (isOpen) {
      // 過濾有完整上下班刷卡時間的記錄
      const filtered = reports.filter(r => Boolean(r.clockIn && r.clockOut));
      setFilteredReports(filtered);
      
      // 初始化記錄選擇狀態
      const initialSelection: { [key: number]: boolean } = {};
      filtered.forEach((report, index) => {
        // 有請假但有打卡時間的記錄，預設不選中（需要用戶確認）
        if (report.attendanceType && report.attendanceType !== '空' && report.attendanceType !== '') {
          if (report.clockIn && report.clockOut) {
            initialSelection[index] = false; // 預設不選中，需要用戶確認
          } else {
            initialSelection[index] = false; // 沒有打卡時間，不選中
          }
        } else {
          initialSelection[index] = true; // 正常上班日，預設選中
        }
      });
      setRecordSelection(initialSelection);

      // 初始化加班原因
      const initialReasons: { [key: number]: string } = {};
      filtered.forEach((report, index) => {
        initialReasons[index] = report.overtimeReason || '';
      });
      setEditedReasons(initialReasons);

      // 重置國定假日標記、工作地點與備註
      setHolidayFlags({});
      setWorkLocation('');
      setRemarks('');
    }
  }, [isOpen, reports]);

  if (!isOpen) return null;

  /**
   * 處理國定假日標記切換事件
   * @param {number} index - 記錄索引
   * @param {string} date - 日期字串
   */
  const handleHolidayToggle = (index: number, date: string) => {
    const newIsHoliday = !holidayFlags[date];
    setHolidayFlags(prev => ({ ...prev, [date]: newIsHoliday }));
    
    // 重新計算該記錄的加班時數和誤餐費
    const updatedReports = [...filteredReports];
    updatedReports[index] = recalculateOvertimeReport(updatedReports[index], newIsHoliday);
    setFilteredReports(updatedReports);
  };

  /**
   * 處理記錄選擇切換事件
   * @param {number} index - 記錄索引
   */
  const handleRecordSelection = (index: number) => {
    setRecordSelection(prev => ({ ...prev, [index]: !prev[index] }));
  };

  /**
   * 處理加班原因編輯事件
   * @param {number} index - 記錄索引
   * @param {string} newReason - 新的加班原因
   */
  const handleReasonChange = (index: number, newReason: string) => {
    if (newReason.length > OVERTIME_REASON_MAX_LENGTH) {
      alert(`加班理由最多 ${OVERTIME_REASON_MAX_LENGTH} 字元（含中英文與符號）。`);
      return;
    }
    setEditedReasons(prev => ({ ...prev, [index]: newReason }));
  };

  /**
   * 取得選中的記錄並更新加班原因與國定假日標記
   * @returns {OvertimeReport[]} 選中的加班報表陣列
   */
  const getSelectedReports = () => {
    return filteredReports
      .map((report, index) => ({
        ...report,
        overtimeReason: editedReasons[index] || report.overtimeReason,
        isHoliday: holidayFlags[report.date] || false,
      }))
      .filter((_, index) => recordSelection[index] === true);
  };

  /**
   * 判斷記錄是否為例假日（週六、週日或國定假日）
   * @param {OvertimeReport} report - 加班報表
   * @returns {boolean} 是否為例假日
   */
  const isHolidayRecord = (report: OvertimeReport): boolean => {
    // 如果手動標記為國定假日
    if (holidayFlags[report.date]) return true;
    
    // 解析日期判斷星期幾
    const dateStr = report.date;
    if (/^\d{7}$/.test(dateStr)) {
      const rocYear = parseInt(dateStr.substring(0, 3));
      const month = parseInt(dateStr.substring(3, 5));
      const day = parseInt(dateStr.substring(5, 7));
      const year = rocYear + 1911;
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // 週日或週六
    }
    
    return false;
  };

  /**
   * 分離平日與例假日記錄（附加 reportIndex 供後續使用）
   */
  const weekdayReports: Array<OvertimeReport & { reportIndex: number }> = [];
  const holidayReports: Array<OvertimeReport & { reportIndex: number }> = [];
  
  filteredReports.forEach((report, index) => {
    if (isHolidayRecord(report)) {
      holidayReports.push({ ...report, reportIndex: index });
    } else {
      weekdayReports.push({ ...report, reportIndex: index });
    }
  });

  /**
   * 渲染表格區塊
   * @param {string} title - 表格標題
   * @param {Array<OvertimeReport & { reportIndex: number }>} records - 加班記錄陣列（附加索引）
   * @param {number} pageNumber - 頁碼
   * @returns {JSX.Element | null} 表格組件或 null
   */
  const renderTable = (title: string, records: Array<OvertimeReport & { reportIndex: number }>, pageNumber: number) => {
    if (records.length === 0) return null;

    return (
      <div className="table-section">
        <h3>{title}</h3>
        <table className="preview-table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th>選擇</th>
              <th>國定假日</th>
              <th>日期</th>
              <th>考勤別</th>
              <th>上班時間</th>
              <th>下班時間</th>
              <th>加班時間</th>
              <th>加班時數</th>
              <th>誤餐費</th>
              <th>加班原因</th>
            </tr>
          </thead>
          <tbody>
            {records.map((report, rowIndex) => {
              const index = report.reportIndex;
              const isLeaveDay = report.attendanceType && report.attendanceType !== '空' && report.attendanceType !== '';
              const hasClockTime = Boolean(report.clockIn && report.clockOut);
              const isUnderThreshold = report.overtimeHours < 0.5;
              const shouldHighlight = isLeaveDay && hasClockTime;
              // 選擇欄勾選且有完整打卡，並達到 0.5 小時門檻才可編輯
              const isOvertimeEditable =
                recordSelection[index] && hasClockTime && !isLeaveDay && !isUnderThreshold;
              const reasonStateClass = !recordSelection[index]
                ? 'reason-unselected'
                : isLeaveDay
                  ? 'reason-disabled-leave'
                  : !hasClockTime
                    ? 'reason-disabled-missing-clock'
                    : isUnderThreshold
                      ? 'reason-disabled-threshold'
                      : 'reason-editable';

              return (
                <tr key={index} className={shouldHighlight ? 'highlight-leave-day' : ''}>
                  <td>{rowIndex + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={recordSelection[index] || false}
                      onChange={() => handleRecordSelection(index)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={holidayFlags[report.date] || false}
                      onChange={() => handleHolidayToggle(index, report.date)}
                      title="勾選表示此日為國定假日"
                    />
                  </td>
                  <td>{formatDate(report.date)}</td>
                  <td>{report.attendanceType || '-'}</td>
                  <td>{report.clockIn}</td>
                  <td>{report.clockOut}</td>
                  <td>{report.overtimeRange}</td>
                  <td>{report.overtimeHours.toFixed(2)}</td>
                  <td>{report.mealAllowance}</td>
                  <td>
                    <input
                      type="text"
                      value={editedReasons[index] || ''}
                      onChange={(e) => handleReasonChange(index, e.target.value)}
                      placeholder={
                        isLeaveDay
                          ? `請${report.attendanceType}`
                          : isUnderThreshold
                            ? '未達30分鐘'
                            : !hasClockTime
                              ? '缺少刷卡時間'
                              : '請輸入原因'
                      }
                      disabled={!isOvertimeEditable}
                      className={`reason-input ${reasonStateClass}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '14px', color: '#666' }}>
          頁碼：{pageNumber}
        </div>
      </div>
    );
  };

  /**
   * 依區塊記錄彙整員工資訊（員工編號＋員工姓名）
   * - 單一員工：直接顯示「A123 王小明」
   * - 多位員工：以頓號串接，避免重複顯示
   */
  const buildEmployeeSummary = (
    records: Array<OvertimeReport & { reportIndex: number }>
  ): string => {
    const employeeSet = new Set<string>();

    records.forEach((report) => {
      const employeeId = report.employeeId?.trim();
      const employeeName = report.name?.trim();
      if (employeeId || employeeName) {
        employeeSet.add([employeeId, employeeName].filter(Boolean).join(' '));
      }
    });

    return employeeSet.size > 0
      ? Array.from(employeeSet).join('、')
      : '無員工資訊';
  };

  /**
   * 依區塊記錄彙整申請年月（民國年格式）
   * - 來源：報表資料中的 date 欄位
   * - 7 碼民國格式（YYYMMDD）轉為「YYY年MM月」
   * - 若同區塊有多個月份，使用頓號串接
   */
  const buildYearMonthSummary = (
    records: Array<OvertimeReport & { reportIndex: number }>
  ): string => {
    const yearMonthSet = new Set<string>();

    records.forEach((report) => {
      const dateStr = report.date?.trim() ?? '';
      if (/^\d{7}$/.test(dateStr)) {
        const rocYear = dateStr.substring(0, 3);
        const month = dateStr.substring(3, 5);
        yearMonthSet.add(`${rocYear}年${month}月`);
      }
    });

    return yearMonthSet.size > 0
      ? Array.from(yearMonthSet).join('、')
      : '無申請年月';
  };

  /**
   * 驗證工作地點是否已填寫
   * @returns {boolean} 驗證結果
   */
  const validateWorkLocation = (): { isValid: boolean; errorMessage: string } => {
    // 驗證平日加班工作地點
    if (weekdayReports.length > 0 && !workLocation.trim()) {
      return {
        isValid: false,
        errorMessage: '請輸入平日加班的工作地點'
      };
    }
    
    // 驗證例假日加班工作地點
    if (holidayReports.length > 0 && !holidayWorkLocation.trim()) {
      return {
        isValid: false,
        errorMessage: '請輸入例假日加班的工作地點'
      };
    }
    
    return {
      isValid: true,
      errorMessage: ''
    };
  };

  /**
   * 驗證選中記錄的加班原因是否都已填寫
   * @returns {{ isValid: boolean; missingIndexes: number[] }} 驗證結果
   */
  const validateOvertimeReasons = (): { isValid: boolean; missingLocations: string[]; tooLongLocations: string[] } => {
    const missingLocations: string[] = [];
    const tooLongLocations: string[] = [];

    const collectIssuesBySection = (
      sectionName: '平日加班' | '例假日加班',
      records: Array<OvertimeReport & { reportIndex: number }>
    ) => {
      records.forEach((report, sectionIndex) => {
        const recordIndex = report.reportIndex;
        if (!recordSelection[recordIndex]) return;

        const itemNumber = sectionIndex + 1;
        const pageNumber = Math.floor(sectionIndex / PREVIEW_ITEMS_PER_PAGE) + 1;
        const locationText = `${sectionName} 第${pageNumber}頁 ITEM 第${itemNumber}筆`;
        const currentReason = (editedReasons[recordIndex] || report.overtimeReason || '').trim();

        // 需要填寫加班原因的條件：有完整刷卡且加班時數 >= 0.5 小時
        const hasClockTime = Boolean(report.clockIn && report.clockOut);
        const needsReason = hasClockTime && report.overtimeHours >= 0.5;

        if (needsReason && currentReason === '') {
          missingLocations.push(locationText);
        }

        if (currentReason.length > OVERTIME_REASON_MAX_LENGTH) {
          tooLongLocations.push(locationText);
        }
      });
    };

    collectIssuesBySection('平日加班', weekdayReports);
    collectIssuesBySection('例假日加班', holidayReports);

    return {
      isValid: missingLocations.length === 0 && tooLongLocations.length === 0,
      missingLocations,
      tooLongLocations
    };
  };

  /**
   * 完整驗證（工作地點 + 加班原因）
   * @returns {{ isValid: boolean; errorMessage: string }} 驗證結果
   */
  const validateAll = (): { isValid: boolean; errorMessage: string } => {
    // 驗證工作地點
    const locationValidation = validateWorkLocation();
    if (!locationValidation.isValid) {
      return locationValidation;
    }

    const weekdayWorkLocationLen = Array.from(workLocation.replace(/\r?\n/g, '')).length;
    const holidayWorkLocationLen = Array.from(holidayWorkLocation.replace(/\r?\n/g, '')).length;
    if (weekdayReports.length > 0 && weekdayWorkLocationLen > REPORT_WORK_LOCATION_MAX_CHARS) {
      return {
        isValid: false,
        errorMessage: `平日加班工作地點最多 ${REPORT_WORK_LOCATION_MAX_CHARS} 字。`
      };
    }
    if (holidayReports.length > 0 && holidayWorkLocationLen > REPORT_WORK_LOCATION_MAX_CHARS) {
      return {
        isValid: false,
        errorMessage: `例假日加班工作地點最多 ${REPORT_WORK_LOCATION_MAX_CHARS} 字。`
      };
    }

    const weekdayRemarkLength = Array.from((remarks || '').replace(/\r?\n/g, '')).length;
    const holidayRemarkLength = Array.from((holidayRemarks || '').replace(/\r?\n/g, '')).length;
    if (weekdayReports.length > 0 && weekdayRemarkLength > REMARK_MAX_LENGTH) {
      return {
        isValid: false,
        errorMessage: `平日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`
      };
    }
    if (holidayReports.length > 0 && holidayRemarkLength > REMARK_MAX_LENGTH) {
      return {
        isValid: false,
        errorMessage: `例假日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`
      };
    }

    // 驗證加班原因
    const reasonValidation = validateOvertimeReasons();
    if (!reasonValidation.isValid) {
      if (reasonValidation.missingLocations.length > 0) {
        return {
          isValid: false,
          errorMessage: `請先填寫所有記錄的加班原因。\n未填寫的記錄：\n- ${reasonValidation.missingLocations.join('\n- ')}`
        };
      }

      return {
        isValid: false,
        errorMessage: `加班理由最多 ${OVERTIME_REASON_MAX_LENGTH} 字元（含中英文與符號）。\n超長記錄：\n- ${reasonValidation.tooLongLocations.join('\n- ')}`
      };
    }

    return {
      isValid: true,
      errorMessage: ''
    };
  };

  /**
   * 處理下載 Excel 事件（含驗證）
   */
  const handleDownloadExcel = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter(r => !isHolidayRecord(r));
    const selectedHoliday = selected.filter(r => isHolidayRecord(r));
    onDownloadExcel(selectedWeekday, selectedHoliday, workLocation, remarks, holidayWorkLocation, holidayRemarks);
  };

  /**
   * 處理下載 PDF 事件（含驗證）
   */
  const handleDownloadPdf = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter(r => !isHolidayRecord(r));
    const selectedHoliday = selected.filter(r => isHolidayRecord(r));
    onDownloadPdf(selectedWeekday, selectedHoliday, workLocation, remarks, holidayWorkLocation, holidayRemarks);
  };

  /**
   * 處理列印事件（含驗證）
   */
  const handlePrint = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter(r => !isHolidayRecord(r));
    const selectedHoliday = selected.filter(r => isHolidayRecord(r));
    onPrint(selectedWeekday, selectedHoliday, workLocation, remarks, holidayWorkLocation, holidayRemarks);
  };

  /**
   * 合併多頁 TXT 內容，移除重複頁首與分頁資訊
   * 規則：刪除「... 接下頁 ...」前最後一條分隔線到下一頁表頭下方分隔線之間的內容
   */
  const mergePagedTxtForPrint = (rawTxt: string): string => {
    const normalized = rawTxt.replace(/\r\n/g, '\n').replace(/\f/g, '\n');
    const lines = normalized.split('\n');
    const headerMatcher = (line: string) =>
      line.includes('員工姓名') && line.includes('歸屬日期') && line.includes('主管核定');

    let searchFrom = 0;
    while (true) {
      const nextPageMarker = lines.findIndex((line, idx) => idx >= searchFrom && line.includes('... 接下頁 ...'));
      if (nextPageMarker < 0) break;

      let removeStart = -1;
      for (let i = nextPageMarker; i >= 0; i--) {
        if (lines[i].includes('====')) {
          removeStart = i;
          break;
        }
      }

      const secondHeader = lines.findIndex((line, idx) => idx > nextPageMarker && headerMatcher(line));
      if (secondHeader < 0 || removeStart < 0) {
        searchFrom = nextPageMarker + 1;
        continue;
      }

      let removeEnd = -1;
      for (let i = secondHeader + 1; i < lines.length; i++) {
        if (lines[i].includes('====')) {
          removeEnd = i;
          break;
        }
      }

      if (removeEnd < removeStart) {
        searchFrom = secondHeader + 1;
        continue;
      }

      lines.splice(removeStart, removeEnd - removeStart + 1);
      searchFrom = removeStart;
    }

    return lines
      .filter((line, index, arr) => !(line.trim() === '' && arr[index - 1]?.trim() === ''))
      .join('\n')
      .trim();
  };

  /**
   * 以 iframe 列印原始 TXT（比照 Notepad：細明體 8pt、四邊 2mm）。
   * 採 iframe 而非 window.open，以繼承父頁 font context，確保 Mac 上 Noto Sans TC 能正確渲染中文。
   * 等待 fonts.ready 後再觸發列印，避免字型尚未載入就印出空白中文。
   * 檔名格式與下載 PDF 相同，末尾加 _原始TXT。
   */
  const handlePrintRawTxt = () => {
    if (!rawTxtContent.trim()) {
      alert('目前沒有可列印的原始 TXT 內容。');
      return;
    }

    const mergedTxt = mergePagedTxtForPrint(rawTxtContent);

    // 從報表取得員工資訊與年月，組成與下載 PDF 相同規則的標題（用作儲存 PDF 的預設檔名）
    const firstReport = filteredReports[0];
    let docTitle = '員工加班申請表_原始TXT';
    if (firstReport) {
      const employeeName = `${firstReport.employeeId} ${firstReport.name}`.trim();
      const dateStr = firstReport.date ?? '';
      const yearMonth = /^\d{7}$/.test(dateStr)
        ? `${dateStr.substring(0, 3)}年${dateStr.substring(3, 5)}月`
        : '';
      docTitle = yearMonth
        ? `員工加班申請表-${employeeName}-${yearMonth}_原始TXT`
        : `員工加班申請表-${employeeName}_原始TXT`;
    }

    const escapedTxt = mergedTxt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>${docTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 2mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  pre {
    font-family: "Courier New", "Noto Sans TC", "PMingLiU", "MingLiU", monospace, "PingFang TC", "Heiti TC", sans-serif;
    font-size: 8pt;
    line-height: 1.2;
    white-space: pre;
    margin: 0;
    padding: 0;
    color: #000;
  }
  a { color: inherit !important; text-decoration: none !important; pointer-events: none; }
</style>
</head>
<body>
<pre>${escapedTxt}</pre>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      const run = async () => {
        try {
          if (iframe.contentDocument?.fonts) await iframe.contentDocument.fonts.ready;
        } catch { /* ignore */ }
        setTimeout(() => {
          // 暫時替換父頁面標題：iframe 列印時，Chrome/Safari 以父頁面 title 作為儲存 PDF 的預設檔名
          const originalTitle = document.title;
          document.title = docTitle;
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Print failed:', e);
          } finally {
            setTimeout(() => {
              document.title = originalTitle;
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 3000);
          }
        }, 1000);
      };
      void run();
    };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>加班申請預覽</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 說明文字 */}
          <div className="preview-instructions">
            <p>📌 以下顯示有完整上下班刷卡的記錄，已分為「平日加班」與「例假日加班」</p>
            <p>⚠️ 黃色標記為請假日但有打卡記錄，請確認是否包含在申請表中</p>
            <p>🏖️ 勾選「國定假日」可將平日記錄移至例假日區塊（全時段計算）</p>
            <p>
              📝 工作地點最多 {REPORT_WORK_LOCATION_MAX_CHARS} 字；備註欄最多 {REMARK_MAX_LENGTH} 字（每列{' '}
              {REMARK_LINE_LENGTH} 字，共 {REMARK_TOTAL_LINES} 列）
            </p>
            <p>✍️ 加班原因最多 {OVERTIME_REASON_MAX_LENGTH} 字（含中英文與符號）</p>
          </div>

          {/* 平日加班區塊 */}
          {weekdayReports.length > 0 && (
            <div className="overtime-section">
              {/* 平日加班的工作地點和備註 */}
              <div className="input-section">
                <h3>平日加班資訊</h3>
                <p className="employee-info-text">
                  員工資訊：{buildEmployeeSummary(weekdayReports)}
                </p>
                <p className="employee-info-text">
                  申請年月：{buildYearMonthSummary(weekdayReports)}
                </p>
                <div className="input-group">
                  <label className="label-left">
                    工作地點：<span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={workLocation}
                    maxLength={REPORT_WORK_LOCATION_MAX_CHARS}
                    onChange={(e) => setWorkLocation(normalizeWorkLocationInput(e.target.value))}
                    placeholder="請輸入工作地點"
                  />
                </div>
                <div className="input-group">
                  <label className="label-left">
                    備註：(最多 {REMARK_MAX_LENGTH} 字元)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => {
                      const normalized = normalizeRemarkInput(e.target.value);
                      if (Array.from(e.target.value.replace(/\r?\n/g, '')).length > REMARK_MAX_LENGTH) {
                        alert(`平日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`);
                      }
                      setRemarks(normalized);
                    }}
                    placeholder="請輸入備註（選填）"
                    rows={3}
                    maxLength={REMARK_MAX_LENGTH}
                  />
                </div>
              </div>
              {/* 平日加班表格 */}
              {renderTable('平日加班', weekdayReports, 1)}
            </div>
          )}

          {/* 例假日加班區塊 */}
          {holidayReports.length > 0 && (
            <div className="overtime-section">
              {/* 例假日加班的工作地點和備註 */}
              <div className="input-section">
                <h3>例假日加班資訊</h3>
                <p className="employee-info-text">
                  員工資訊：{buildEmployeeSummary(holidayReports)}
                </p>
                <p className="employee-info-text">
                  申請年月：{buildYearMonthSummary(holidayReports)}
                </p>
                <div className="input-group">
                  <label className="label-left">
                    工作地點：<span className="required">*</span>
                  </label>
                  <div className="input-with-copy">
                    <input
                      type="text"
                      value={holidayWorkLocation}
                      maxLength={REPORT_WORK_LOCATION_MAX_CHARS}
                      onChange={(e) => setHolidayWorkLocation(normalizeWorkLocationInput(e.target.value))}
                      placeholder="請輸入工作地點"
                    />
                    {weekdayReports.length > 0 && (
                      <button
                        type="button"
                        className="copy-icon-button"
                        onClick={() => setHolidayWorkLocation(workLocation)}
                        title="從平日加班複製工作地點"
                      >
                        📋 複製
                      </button>
                    )}
                  </div>
                </div>
                <div className="input-group">
                  <label className="label-left">
                    備註：
                  </label>
                  <div className="input-with-copy">
                    <textarea
                      value={holidayRemarks}
                      onChange={(e) => {
                        const normalized = normalizeRemarkInput(e.target.value);
                        if (Array.from(e.target.value.replace(/\r?\n/g, '')).length > REMARK_MAX_LENGTH) {
                          alert(`例假日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`);
                        }
                        setHolidayRemarks(normalized);
                      }}
                      placeholder="請輸入備註（選填）"
                      rows={3}
                      maxLength={REMARK_MAX_LENGTH}
                    />
                    {weekdayReports.length > 0 && (
                      <button
                        type="button"
                        className="copy-icon-button"
                        onClick={() => setHolidayRemarks(remarks)}
                        title="從平日加班複製備註"
                      >
                        📋 複製
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* 例假日加班表格 */}
              {renderTable('例假日加班', holidayReports, 1)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-confirm" onClick={handlePrintRawTxt} disabled={!rawTxtContent.trim()}>
            列印原始TXT
          </button>
          <button className="btn-confirm" onClick={handleDownloadExcel}>下載 Excel</button>
          <button className="btn-confirm" onClick={handleDownloadPdf}>下載 PDF</button>
          <button className="btn-confirm" onClick={handlePrint}>列印</button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
