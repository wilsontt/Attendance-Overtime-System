import React from 'react';
import type { OvertimeReport } from '../../src/types';

interface AttendanceTableProps {
  reports: OvertimeReport[];
  onReasonChange: (index: number, newReason: string) => void;
}

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
          const isEditable = report.overtimeHours >= 0.5;
          
          return (
            <tr key={index}>
              <td>{report.employeeId}</td>
              <td>{report.name}</td>
              <td>{report.date}</td>
              <td>
                <input 
                  type="text" 
                  value={report.overtimeReason} 
                  onChange={(e) => onReasonChange(index, e.target.value)}
                  placeholder={isEditable ? "請輸入原因" : "未達加班標準"}
                  style={{ width: '100%', border: '1px solid #ddd', padding: '4px' }}
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
