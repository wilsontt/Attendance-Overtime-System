import React, { useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OvertimeReport } from '../../src/types';

interface ReportGeneratorProps {
  reports: OvertimeReport[]; // 保留以維持相容性，但實際使用 selectedReports
  selectedReports: OvertimeReport[];
  workLocation: string;
  previewType: 'excel' | 'pdf' | 'print';
  onOpenPreview: (type: 'excel' | 'pdf' | 'print') => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ 
  // reports, // 未使用，但保留在 props 中以維持介面相容性
  selectedReports, 
  workLocation, 
  previewType,
  onOpenPreview 
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  // 當 selectedReports 有變化時，執行對應的報表生成
  useEffect(() => {
    if (selectedReports.length > 0) {
      if (previewType === 'excel') {
        generateExcel();
      } else if (previewType === 'pdf') {
        generatePdf();
      } else if (previewType === 'print') {
        printReport();
      }
    }
  }, [selectedReports, previewType]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateExcel = async () => {
    if (selectedReports.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('加班申請表');

    // 取得第一筆記錄以獲取員工資訊
    const firstReport = selectedReports[0];
    const employeeName = `${firstReport.employeeId} ${firstReport.name}`;

    // 取得申請年月
    const dateStr = firstReport.date;
    let yearMonth = '';
    if (/^\d{7}$/.test(dateStr)) {
      const rocYear = dateStr.substring(0, 3);
      const month = dateStr.substring(3, 5);
      yearMonth = `${rocYear}年${month}月`;
    }

    // 標題
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '海灣國際股份有限公司員工加班申請表';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // 申請年月
    worksheet.mergeCells('A2:F2');
    const yearMonthCell = worksheet.getCell('A2');
    yearMonthCell.value = `申請年月：${yearMonth}`;
    yearMonthCell.font = { size: 12, bold: true };
    yearMonthCell.alignment = { horizontal: 'center' };

    // 員工資訊
    worksheet.mergeCells('A3:C3');
    worksheet.getCell('A3').value = `員工姓名：${employeeName}`;
    worksheet.mergeCells('D3:F3');
    worksheet.getCell('D3').value = `工作地點：${workLocation}`;

    // 備註
    worksheet.mergeCells('A4:F4');
    worksheet.getCell('A4').value = '備註：';

    // 表格標題
    const headerRow = worksheet.addRow(['日期', '時間', '加班原因', '加班時數', '誤餐費']);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 資料列
    selectedReports.forEach(report => {
      const row = worksheet.addRow([
        report.date,
        report.overtimeRange,
        report.overtimeReason || '',
        report.overtimeHours.toFixed(2),
        report.mealAllowance
      ]);
      
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // 設定欄寬
    worksheet.getColumn(1).width = 15; // 日期
    worksheet.getColumn(2).width = 20; // 時間
    worksheet.getColumn(3).width = 25; // 加班原因
    worksheet.getColumn(4).width = 12; // 加班時數
    worksheet.getColumn(5).width = 10; // 誤餐費

    // 產生並下載
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `員工加班申請表-${employeeName}-${yearMonth}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generatePdf = async () => {
    if (!printRef.current || selectedReports.length === 0) return;

    try {
      // 暫時顯示元素以供 html2canvas 截圖
      printRef.current.style.display = 'block';

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: printRef.current.scrollWidth,
        windowHeight: printRef.current.scrollHeight
      });
      
      // 隱藏元素
      printRef.current.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const firstReport = selectedReports[0];
      const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
      pdf.save(`員工加班申請表-${employeeName}.pdf`);
    } catch (error) {
      console.error('PDF 生成失敗:', error);
      alert('PDF 生成失敗，請稍後再試');
    }
  };

  const printReport = () => {
    if (selectedReports.length === 0) return;

    const firstReport = selectedReports[0];
    const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
    
    // 取得申請年月
    const dateStr = firstReport.date;
    let yearMonth = '';
    if (/^\d{7}$/.test(dateStr)) {
      const rocYear = dateStr.substring(0, 3);
      const month = dateStr.substring(3, 5);
      yearMonth = `${rocYear}年${month}月`;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>員工加班申請表</title>
            <style>
              body { font-family: "Microsoft JhengHei", "Heiti TC", sans-serif; margin: 20px; }
              .title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 10px; }
              .year-month { font-size: 14px; text-align: center; margin-bottom: 20px; }
              .info { margin-bottom: 15px; font-size: 14px; }
              .info-row { display: flex; margin-bottom: 5px; }
              .info-row div { flex: 1; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
              th, td { border: 1px solid black; padding: 6px 8px; text-align: left; }
              th { background-color: #f0f0f0; font-weight: bold; }
              @media print {
                body { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="title">海灣國際股份有限公司員工加班申請表</div>
            <div class="year-month">申請年月：${yearMonth}</div>
            <div class="info">
              <div class="info-row">
                <div>員工姓名：${employeeName}</div>
                <div>工作地點：${workLocation}</div>
              </div>
              <div class="info-row">
                <div>備註：</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>時間</th>
                  <th>加班原因</th>
                  <th>加班時數</th>
                  <th>誤餐費</th>
                </tr>
              </thead>
              <tbody>
                ${selectedReports.map(report => `
                  <tr>
                    <td>${report.date}</td>
                    <td>${report.overtimeRange}</td>
                    <td>${report.overtimeReason || ''}</td>
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

  // 準備 PDF 生成的資料
  const getPdfContent = () => {
    if (selectedReports.length === 0) return null;

    const firstReport = selectedReports[0];
    const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
    
    // 取得申請年月
    const dateStr = firstReport.date;
    let yearMonth = '';
    if (/^\d{7}$/.test(dateStr)) {
      const rocYear = dateStr.substring(0, 3);
      const month = dateStr.substring(3, 5);
      yearMonth = `${rocYear}年${month}月`;
    }

    return { employeeName, yearMonth };
  };

  const pdfData = getPdfContent();

  return (
    <div style={{ marginTop: '20px' }}>
      <button 
        onClick={() => onOpenPreview('excel')} 
        style={{ marginRight: '10px', padding: '10px 15px' }}
      >
        下載 Excel
      </button>
      <button 
        onClick={() => onOpenPreview('pdf')} 
        style={{ marginRight: '10px', padding: '10px 15px' }}
      >
        下載 PDF
      </button>
      <button 
        onClick={() => onOpenPreview('print')} 
        style={{ padding: '10px 15px' }}
      >
        列印報告
      </button>

      {/* 隱藏的 PDF 生成專用表格 */}
      {pdfData && (
        <div 
          ref={printRef} 
          style={{ 
            display: 'none',
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
          <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '20px' }}>
            海灣國際股份有限公司員工加班申請表
          </h2>
          <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px' }}>
            申請年月：{pdfData.yearMonth}
          </div>
          <div style={{ marginBottom: '15px', fontSize: '14px' }}>
            <div style={{ marginBottom: '5px' }}>員工姓名：{pdfData.employeeName}</div>
            <div style={{ marginBottom: '5px' }}>工作地點：{workLocation}</div>
            <div>備註：</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid black', padding: '6px 8px', textAlign: 'left' }}>日期</th>
                <th style={{ border: '1px solid black', padding: '6px 8px', textAlign: 'left' }}>時間</th>
                <th style={{ border: '1px solid black', padding: '6px 8px', textAlign: 'left' }}>加班原因</th>
                <th style={{ border: '1px solid black', padding: '6px 8px', textAlign: 'left' }}>加班時數</th>
                <th style={{ border: '1px solid black', padding: '6px 8px', textAlign: 'left' }}>誤餐費</th>
              </tr>
            </thead>
            <tbody>
              {selectedReports.map((report, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid black', padding: '6px 8px' }}>{report.date}</td>
                  <td style={{ border: '1px solid black', padding: '6px 8px' }}>{report.overtimeRange}</td>
                  <td style={{ border: '1px solid black', padding: '6px 8px' }}>{report.overtimeReason || ''}</td>
                  <td style={{ border: '1px solid black', padding: '6px 8px' }}>{report.overtimeHours.toFixed(2)}</td>
                  <td style={{ border: '1px solid black', padding: '6px 8px' }}>{report.mealAllowance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
