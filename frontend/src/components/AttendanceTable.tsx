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
}

/**
 * AttendanceTable 組件
 * @param {AttendanceTableProps} props - 組件屬性
 * @returns {JSX.Element} 出勤表格組件
 */
const AttendanceTable: React.FC<AttendanceTableProps> = ({ reports, onReasonChange }) => {
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
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default AttendanceTable;
