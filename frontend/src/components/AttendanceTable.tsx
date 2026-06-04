/**
 * 出勤表格組件
 * 
 * 用途：顯示計算後的加班報表，並提供加班原因編輯功能
 * 流程：
 * 1. 以表格形式呈現所有加班記錄
 * 2. 顯示員工資訊、上下班時間、加班時數、誤餐費等欄位
 * 3. 提供可編輯的加班原因輸入欄位
 * 4. 需有完整上下班刷卡時間且加班時數達 0.5 小時才可編輯加班原因
 */

import React from 'react';
import type { OvertimeReport } from '../../src/types';
import { formatDate } from '../utils/dateFormatter';

/**
 * AttendanceTable 組件的 Props 介面
 */
interface AttendanceTableProps {
  /** 加班報表陣列 */
  reports: OvertimeReport[];
  /** 加班原因變更回呼函數 */
  onReasonChange: (index: number, newReason: string) => void;
  /** 「加到例假日加班」強制標記（key: `${employeeId}__${date}`） */
  holidayOverrides: Record<string, boolean>;
  /** 切換「加到例假日加班」強制標記回呼函數 */
  onToggleHolidayOverride: (employeeId: string, date: string) => void;
  /** 「加到平日加班」強制標記（key: `${employeeId}__${date}`） */
  weekdayOverrides: Record<string, boolean>;
  /** 切換「加到平日加班」強制標記回呼函數 */
  onToggleWeekdayOverride: (employeeId: string, date: string) => void;
}

/**
 * 取得日期的星期幾（0=週日 ~ 6=週六），無法解析時回傳 null。
 * @param {string} dateStr - 歸屬日期（民國年 7 碼格式：1141001）
 * @returns {number | null} 星期幾
 */
const getDayOfWeek = (dateStr: string): number | null => {
  if (!/^\d{7}$/.test(dateStr)) return null;
  const year = parseInt(dateStr.substring(0, 3)) + 1911;
  const month = parseInt(dateStr.substring(3, 5)) - 1;
  const day = parseInt(dateStr.substring(5, 7));
  return new Date(year, month, day).getDay();
};

/**
 * 判斷日期是否為平日（週一至週五）。
 * 僅平日記錄需要「加到例假日加班」選項，週六日本即為例假日。
 * @param {string} dateStr - 歸屬日期（民國年 7 碼格式：1141001）
 * @returns {boolean} 是否為平日
 */
const isWeekday = (dateStr: string): boolean => {
  const dayOfWeek = getDayOfWeek(dateStr);
  return dayOfWeek !== null && dayOfWeek >= 1 && dayOfWeek <= 5;
};

/**
 * 判斷日期是否為週末（週六或週日）。
 * 僅週末記錄需要「加到平日加班」選項（補班日落在週末）。
 * @param {string} dateStr - 歸屬日期（民國年 7 碼格式：1141001）
 * @returns {boolean} 是否為週末
 */
const isWeekend = (dateStr: string): boolean => {
  const dayOfWeek = getDayOfWeek(dateStr);
  return dayOfWeek === 0 || dayOfWeek === 6;
};

/**
 * AttendanceTable 組件
 * @param {AttendanceTableProps} props - 組件屬性
 * @returns {JSX.Element} 出勤表格組件
 */
const AttendanceTable: React.FC<AttendanceTableProps> = ({ reports, onReasonChange, holidayOverrides, onToggleHolidayOverride, weekdayOverrides, onToggleWeekdayOverride }) => {
  return (
    <table className="attendance-table">
      <thead>
        <tr>
          <th>員工編號</th>
          <th>姓名</th>
          <th>日期</th>
          <th>加班原因</th>
          <th>上班時間</th>
          <th>下班時間</th>
          <th>加班時間</th>
          <th>加班時數</th>
          <th>誤餐費</th>
          <th>加到例假日加班</th>
          <th>加到平日加班</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report, index) => {
          const hasClockTime = Boolean(report.clockIn && report.clockOut);
          const isLeaveDay = Boolean(report.attendanceType && report.attendanceType !== '空');
          const isUnderThreshold = report.overtimeHours < 0.5;
          const isEditable = hasClockTime && !isLeaveDay && !isUnderThreshold;
          const reasonStateClass = isLeaveDay
            ? 'reason-disabled-leave'
            : !hasClockTime
              ? 'reason-disabled-missing-clock'
              : isUnderThreshold
                ? 'reason-disabled-threshold'
                : 'reason-editable';
          
          return (
            <tr key={index}>
              <td>{report.employeeId}</td>
              <td>{report.name}</td>
              <td>{formatDate(report.date)}</td>
              <td>
                <input 
                  type="text" 
                  value={report.overtimeReason} 
                  onChange={(e) => onReasonChange(index, e.target.value)}
                  placeholder={
                    isLeaveDay
                      ? `請${report.attendanceType}`
                      : isUnderThreshold
                        ? '未達30分鐘'
                        : !hasClockTime
                          ? '缺少刷卡時間'
                          : '請輸入原因'
                  }
                  className={`reason-input ${reasonStateClass}`}
                  disabled={!isEditable}
                />
              </td>
              <td>{report.clockIn}</td>
              <td>{report.clockOut}</td>
              <td>{report.overtimeRange}</td>
              <td>{report.overtimeHours.toFixed(2)}</td>
              <td>{report.mealAllowance}</td>
              <td style={{ textAlign: 'center' }}>
                {isWeekday(report.date) ? (
                  <input
                    type="checkbox"
                    checked={holidayOverrides[`${report.employeeId}__${report.date}`] || false}
                    onChange={() => onToggleHolidayOverride(report.employeeId, report.date)}
                    title="勾選後，下載時此平日記錄將改列入「例假日加班」並以全日重算"
                  />
                ) : (
                  <span style={{ color: '#999' }}>—</span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>
                {isWeekend(report.date) ? (
                  <input
                    type="checkbox"
                    checked={weekdayOverrides[`${report.employeeId}__${report.date}`] || false}
                    onChange={() => onToggleWeekdayOverride(report.employeeId, report.date)}
                    title="勾選後，下載時此週末（補班）記錄將改列入「平日加班」並以 18:00 起算重算"
                  />
                ) : (
                  <span style={{ color: '#999' }}>—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default AttendanceTable;
