/**
 * 預覽 Modal 組件
 * 
 * 用途：提供加班申請表預覽、記錄選擇、國定假日標記與下載功能
 * 流程：
 * 1. 過濾加班時數 >= 0.5 的記錄
 * 2. 分離平日加班與例假日加班記錄
 * 3. 使用者可勾選要包含在申請表中的記錄
 * 4. 使用者可標記國定假日（影響加班時數計算）
 * 5. 使用者填寫工作地點與加班原因
 * 6. 驗證必填欄位後下載 Excel/PDF 或列印
 */

import React, { useState, useEffect } from 'react';
import type { OvertimeReport } from '../types';
import { recalculateOvertimeReport } from '../services/calculationService';
import './PreviewModal.css';

/**
 * PreviewModal 組件的 Props 介面
 */
interface PreviewModalProps {
  /** 加班報表陣列 */
  reports: OvertimeReport[];
  /** Modal 開關狀態 */
  isOpen: boolean;
  /** 關閉 Modal 回呼函數 */
  onClose: () => void;
  /** 下載 Excel 回呼函數 */
  onDownloadExcel: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
  /** 下載 PDF 回呼函數 */
  onDownloadPdf: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
  /** 列印回呼函數 */
  onPrint: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
}

/**
 * PreviewModal 組件
 * @param {PreviewModalProps} props - 組件屬性
 * @returns {JSX.Element | null} 預覽 Modal 組件
 */
const PreviewModal: React.FC<PreviewModalProps> = ({ 
  reports, 
  isOpen, 
  onClose, 
  onDownloadExcel,
  onDownloadPdf,
  onPrint
}) => {
  /** 過濾出加班時數 >= 0.5 的記錄 */
  const [filteredReports, setFilteredReports] = useState<OvertimeReport[]>([]);
  
  /** 工作地點 */
  const [workLocation, setWorkLocation] = useState<string>('');
  
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
      // 過濾加班時數 >= 0.5 的記錄
      const filtered = reports.filter(r => r.overtimeHours >= 0.5);
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

      // 重置國定假日標記
      setHolidayFlags({});
      setWorkLocation('');
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
            {records.map((report) => {
              const index = report.reportIndex;
              const isLeaveDay = report.attendanceType && report.attendanceType !== '空' && report.attendanceType !== '';
              const hasClockTime = report.clockIn && report.clockOut;
              const shouldHighlight = isLeaveDay && hasClockTime;
              const isOvertimeEditable = report.overtimeHours >= 0.5 && (!isLeaveDay || !report.attendanceType);

              return (
                <tr key={index} className={shouldHighlight ? 'highlight-leave-day' : ''}>
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
                  <td>{report.date}</td>
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
                      placeholder={isLeaveDay ? `請${report.attendanceType}` : '請輸入原因'}
                      disabled={!isOvertimeEditable}
                      className={!isOvertimeEditable ? 'disabled-input' : ''}
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
   * 驗證工作地點是否已填寫
   * @returns {boolean} 驗證結果
   */
  const validateWorkLocation = (): boolean => {
    return workLocation.trim() !== '';
  };

  /**
   * 驗證選中記錄的加班原因是否都已填寫
   * @returns {{ isValid: boolean; missingIndexes: number[] }} 驗證結果
   */
  const validateOvertimeReasons = (): { isValid: boolean; missingIndexes: number[] } => {
    const selected = getSelectedReports();
    const missingIndexes: number[] = [];

    selected.forEach((report, idx) => {
      // 排除請假日記錄（考勤別不為空且不為「空」）
      const isLeaveDay = report.attendanceType && report.attendanceType !== '空' && report.attendanceType !== '';
      
      // 需要填寫加班原因的條件：非請假日 且 加班時數 >= 0.5
      const needsReason = !isLeaveDay && report.overtimeHours >= 0.5;
      
      if (needsReason && (!report.overtimeReason || report.overtimeReason.trim() === '')) {
        missingIndexes.push(idx + 1); // 顯示為 1-based 索引
      }
    });

    return {
      isValid: missingIndexes.length === 0,
      missingIndexes
    };
  };

  /**
   * 完整驗證（工作地點 + 加班原因）
   * @returns {{ isValid: boolean; errorMessage: string }} 驗證結果
   */
  const validateAll = (): { isValid: boolean; errorMessage: string } => {
    // 驗證工作地點
    if (!validateWorkLocation()) {
      return {
        isValid: false,
        errorMessage: '請先填寫工作地點。'
      };
    }

    // 驗證加班原因
    const reasonValidation = validateOvertimeReasons();
    if (!reasonValidation.isValid) {
      return {
        isValid: false,
        errorMessage: `請先填寫所有記錄的加班原因。\n未填寫的記錄：第 ${reasonValidation.missingIndexes.join(', ')} 筆`
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
    onDownloadExcel(selectedWeekday, selectedHoliday, workLocation);
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
    onDownloadPdf(selectedWeekday, selectedHoliday, workLocation);
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
    onPrint(selectedWeekday, selectedHoliday, workLocation);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>加班申請預覽</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 工作地點輸入 */}
          <div className="work-location-section">
            <label htmlFor="workLocation">工作地點：<span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              id="workLocation"
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="請輸入工作地點（必填）"
              className="work-location-input"
              required
            />
          </div>

          {/* 說明文字 */}
          <div className="preview-instructions">
            <p>📌 以下顯示加班時數 ≥ 0.5 小時的記錄，已分為「平日加班」與「例假日加班」</p>
            <p>⚠️ 黃色標記為請假日但有打卡記錄，請確認是否包含在申請表中</p>
            <p>🏖️ 勾選「國定假日」可將平日記錄移至例假日區塊（全時段計算）</p>
          </div>

          {/* 預覽表格 */}
          <div className="preview-table-container">
            {renderTable('平日加班', weekdayReports, 1)}
            {renderTable('例假日加班', holidayReports, 2)}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-confirm" onClick={handleDownloadExcel}>下載 Excel</button>
          <button className="btn-confirm" onClick={handleDownloadPdf}>下載 PDF</button>
          <button className="btn-confirm" onClick={handlePrint}>列印</button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
