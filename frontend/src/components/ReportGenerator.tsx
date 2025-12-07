import React, { useRef } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OvertimeReport } from '../../src/types';

interface ReportGeneratorProps {
  reports: OvertimeReport[];
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ reports }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const generateExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('加班報告');

    // Add headers
    worksheet.columns = [
      { header: '員工編號', key: 'employeeId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      { header: '日期', key: 'date', width: 15 },
      { header: '加班原因', key: 'overtimeReason', width: 20 },
      { header: '上班時間', key: 'clockIn', width: 15 },
      { header: '下班時間', key: 'clockOut', width: 15 },
      { header: '加班時間', key: 'overtimeRange', width: 20 },
      { header: '加班時數', key: 'overtimeHours', width: 15 },
      { header: '誤餐費', key: 'mealAllowance', width: 15 },
    ];

    // Add rows
    reports.forEach(report => {
      worksheet.addRow({
        employeeId: report.employeeId,
        name: report.name,
        date: report.date,
        overtimeReason: report.overtimeReason,
        clockIn: report.clockIn,
        clockOut: report.clockOut,
        overtimeRange: report.overtimeRange,
        overtimeHours: report.overtimeHours,
        mealAllowance: report.mealAllowance,
      });
    });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `加班報告-${new Date().toLocaleDateString()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generatePdf = async () => {
    if (!printRef.current) return;

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // 提高解析度
        useCORS: true,
        logging: false,
        windowWidth: printRef.current.scrollWidth,
        windowHeight: printRef.current.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`加班報告-${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF 生成失敗:', error);
      alert('PDF 生成失敗，請稍後再試');
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>出勤加班報告</title>
            <style>
              body { font-family: "Microsoft JhengHei", "Heiti TC", sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid black; padding: 4px 8px; text-align: left; }
              .header { font-size: 18px; font-weight: bold; margin-bottom: 20px; text-align: center; }
              @media print {
                body { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header">出勤加班報告</div>
            <table>
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
                ${reports.map(report => `
                  <tr>
                    <td>${report.employeeId}</td>
                    <td>${report.name}</td>
                    <td>${report.date}</td>
                    <td>${report.overtimeReason || ''}</td>
                    <td>${report.clockIn}</td>
                    <td>${report.clockOut}</td>
                    <td>${report.overtimeRange}</td>
                    <td>${report.overtimeHours.toFixed(2)}</td>
                    <td>${report.mealAllowance}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
      
      if (printWindow.document.readyState === 'complete') {
         setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <button onClick={generateExcel} style={{ marginRight: '10px', padding: '10px 15px' }}>下載 Excel</button>
      <button onClick={generatePdf} style={{ marginRight: '10px', padding: '10px 15px' }}>下載 PDF</button>
      <button onClick={printReport} style={{ padding: '10px 15px' }}>列印報告</button>

      {/* 隱藏的 PDF 生成專用表格 */}
      <div 
        ref={printRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: -10000, 
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm', 
          backgroundColor: 'white', 
          color: 'black',
          fontFamily: '"Microsoft JhengHei", "Heiti TC", sans-serif'
        }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>出勤加班報告</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>員工編號</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>姓名</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>日期</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>加班原因</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>上班時間</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>下班時間</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>加班時間</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>加班時數</th>
              <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>誤餐費</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.employeeId}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.name}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.date}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.overtimeReason}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.clockIn}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.clockOut}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.overtimeRange}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.overtimeHours.toFixed(2)}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{report.mealAllowance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportGenerator;
