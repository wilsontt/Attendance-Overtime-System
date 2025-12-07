import React, { useState, useEffect, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import AttendanceTable from '../components/AttendanceTable';
import ReportGenerator from '../components/ReportGenerator';
import type { AttendanceRecord, OvertimeReport } from '../types';
import { calculateOvertimeAndMealAllowance } from '../services/calculationService';

const HomePage: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [overtimeReports, setOvertimeReports] = useState<OvertimeReport[]>([]);
  const [filterName, setFilterName] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    if (attendanceRecords.length > 0) {
      const reports = calculateOvertimeAndMealAllowance(attendanceRecords);
      setOvertimeReports(reports);
    } else {
      setOvertimeReports([]);
    }
  }, [attendanceRecords]);

  const handleFileProcessed = (records: AttendanceRecord[]) => {
    setAttendanceRecords(records);
  };

  const filteredReports = useMemo(() => {
    return overtimeReports.filter(report => {
      const matchesName = filterName ? report.name.includes(filterName) : true;
      
      const reportDate = new Date(report.date);
      const matchesStartDate = filterStartDate ? reportDate >= new Date(filterStartDate) : true;
      const matchesEndDate = filterEndDate ? reportDate <= new Date(filterEndDate) : true;

      return matchesName && matchesStartDate && matchesEndDate;
    });
  }, [overtimeReports, filterName, filterStartDate, filterEndDate]);


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
        <img 
          src="/logo.png" 
          alt="Company Logo" 
          style={{ height: '60px', marginRight: '15px' }} 
        />
        <h1 style={{ margin: 0 }}>出勤加班單系統</h1>
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
          <AttendanceTable reports={filteredReports} />
          <ReportGenerator reports={filteredReports} />
        </>
      )}
    </div>
  );
};

export default HomePage;
