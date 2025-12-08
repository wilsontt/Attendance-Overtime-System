import React, { useState, useEffect } from 'react';
import type { OvertimeReport } from '../types';
import { recalculateOvertimeReport } from '../services/calculationService';
import './PreviewModal.css';

interface PreviewModalProps {
  reports: OvertimeReport[];
  isOpen: boolean;
  onClose: () => void;
  onDownloadExcel: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
  onDownloadPdf: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
  onPrint: (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ 
  reports, 
  isOpen, 
  onClose, 
  onDownloadExcel,
  onDownloadPdf,
  onPrint
}) => {
  // 過濾出加班時數 >= 0.5 的記錄
  const [filteredReports, setFilteredReports] = useState<OvertimeReport[]>([]);
  
  // 工作地點
  const [workLocation, setWorkLocation] = useState<string>('');
  
  // 國定假日標記（key: date, value: isHoliday）
  const [holidayFlags, setHolidayFlags] = useState<{ [key: string]: boolean }>({});
  
  // 記錄選擇（key: index, value: isSelected）
  const [recordSelection, setRecordSelection] = useState<{ [key: number]: boolean }>({});

  // 加班原因編輯
  const [editedReasons, setEditedReasons] = useState<{ [key: number]: string }>({});

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

  const handleHolidayToggle = (index: number, date: string) => {
    const newIsHoliday = !holidayFlags[date];
    setHolidayFlags(prev => ({ ...prev, [date]: newIsHoliday }));
    
    // 重新計算該記錄的加班時數和誤餐費
    const updatedReports = [...filteredReports];
    updatedReports[index] = recalculateOvertimeReport(updatedReports[index], newIsHoliday);
    setFilteredReports(updatedReports);
  };

  const handleRecordSelection = (index: number) => {
    setRecordSelection(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleReasonChange = (index: number, newReason: string) => {
    setEditedReasons(prev => ({ ...prev, [index]: newReason }));
  };

  // 取得選中的記錄並更新
  const getSelectedReports = () => {
    return filteredReports
      .map((report, index) => ({
        ...report,
        overtimeReason: editedReasons[index] || report.overtimeReason,
        isHoliday: holidayFlags[report.date] || false,
      }))
      .filter((_, index) => recordSelection[index] === true);
  };

  // 判斷記錄是否為例假日（週六、週日或國定假日）
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

  // 分離平日與例假日記錄（附加 index 供後續使用）
  const weekdayReports: Array<OvertimeReport & { reportIndex: number }> = [];
  const holidayReports: Array<OvertimeReport & { reportIndex: number }> = [];
  
  filteredReports.forEach((report, index) => {
    if (isHolidayRecord(report)) {
      holidayReports.push({ ...report, reportIndex: index });
    } else {
      weekdayReports.push({ ...report, reportIndex: index });
    }
  });

  // 渲染表格區塊
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

  // 驗證加班原因是否都已填寫
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

  const handleDownloadExcel = () => {
    const validation = validateOvertimeReasons();
    if (!validation.isValid) {
      alert(`請先填寫所有記錄的加班原因。\n未填寫的記錄：第 ${validation.missingIndexes.join(', ')} 筆`);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter(r => !isHolidayRecord(r));
    const selectedHoliday = selected.filter(r => isHolidayRecord(r));
    onDownloadExcel(selectedWeekday, selectedHoliday, workLocation);
  };

  const handleDownloadPdf = () => {
    const validation = validateOvertimeReasons();
    if (!validation.isValid) {
      alert(`請先填寫所有記錄的加班原因。\n未填寫的記錄：第 ${validation.missingIndexes.join(', ')} 筆`);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter(r => !isHolidayRecord(r));
    const selectedHoliday = selected.filter(r => isHolidayRecord(r));
    onDownloadPdf(selectedWeekday, selectedHoliday, workLocation);
  };

  const handlePrint = () => {
    const validation = validateOvertimeReasons();
    if (!validation.isValid) {
      alert(`請先填寫所有記錄的加班原因。\n未填寫的記錄：第 ${validation.missingIndexes.join(', ')} 筆`);
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
            <label htmlFor="workLocation">工作地點：</label>
            <input
              type="text"
              id="workLocation"
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="請輸入工作地點"
              className="work-location-input"
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
