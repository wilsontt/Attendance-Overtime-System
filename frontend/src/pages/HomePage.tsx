import React, { useState, useEffect, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import AttendanceTable from '../components/AttendanceTable';
import PreviewModal from '../components/PreviewModal';
import type { AttendanceRecord, OvertimeReport } from '../types';
import { calculateOvertimeAndMealAllowance } from '../services/calculationService';
import { generateExcelReport, generatePdfReport, printReport } from '../services/reportService';

const HomePage: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [overtimeReports, setOvertimeReports] = useState<OvertimeReport[]>([]);
  const [filterName, setFilterName] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  
  // PreviewModal 相關狀態
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

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

  const handleReasonChange = (index: number, newReason: string) => {
    const targetReport = filteredReports[index];
    if (!targetReport) return;

    setOvertimeReports(prev => prev.map(report => {
      if (report.employeeId === targetReport.employeeId && report.date === targetReport.date) {
        return { ...report, overtimeReason: newReason };
      }
      return report;
    }));
  };

  // 開啟預覽 Modal
  const handleOpenPreview = () => {
    setIsPreviewModalOpen(true);
  };

  // 關閉預覽 Modal
  const handleClosePreview = () => {
    setIsPreviewModalOpen(false);
  };

  // 下載 Excel
  const handleDownloadExcel = (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => {
    generateExcelReport(weekdayReports, holidayReports, workLocation);
    setIsPreviewModalOpen(false);
  };

  // 下載 PDF
  const handleDownloadPdf = async (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => {
    await generatePdfReport(weekdayReports, holidayReports, workLocation);
    setIsPreviewModalOpen(false);
  };

  // 列印
  const handlePrint = (weekdayReports: OvertimeReport[], holidayReports: OvertimeReport[], workLocation: string) => {
    printReport(weekdayReports, holidayReports, workLocation);
    setIsPreviewModalOpen(false);
  };

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
          <AttendanceTable reports={filteredReports} onReasonChange={handleReasonChange} />
          
          {/* 單一下載按鈕 */}
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
