import React from 'react';
import type { OvertimeReport } from '../../src/types';

interface AttendanceTableProps {
  reports: OvertimeReport[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ reports }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>員工編號</th>
          <th>姓名</th>
          <th>日期</th>
          <th>上班時間</th>
          <th>下班時間</th>
          <th>加班時數</th>
          <th>誤餐費</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report, index) => (
          <tr key={index}>
            <td>{report.employeeId}</td>
            <td>{report.name}</td>
            <td>{report.date}</td>
            <td>{report.clockIn}</td>
            <td>{report.clockOut}</td>
            <td>{report.overtimeHours.toFixed(2)}</td>
            <td>{report.mealAllowance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AttendanceTable;
