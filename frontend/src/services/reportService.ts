/**
 * 報表生成服務
 * 
 * 提供 Excel、PDF、列印報表的純邏輯函數
 * 嚴格按照 20251208_加班申請範本.pdf 的格式輸出
 */

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OvertimeReport } from '../types';
import { formatDate as formatDateWithDayOfWeek } from '../utils/dateFormatter';
import { paginateReportsByHeight } from './paginationService';

/**
 * 取得申請年月（民國年格式）
 * @param {string} dateStr - 日期字串（民國年格式：1141001）
 * @returns {string} 年月字串（格式：114年10月）
 */
function getYearMonth(dateStr: string): string {
  if (/^\d{7}$/.test(dateStr)) {
    const rocYear = dateStr.substring(0, 3);
    const month = dateStr.substring(3, 5);
    return `${rocYear}年${month}月`;
  }
  return '';
}

/**
 * 生成 Excel 報表（兩個工作表：平日加班、例假日加班）
 * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
 * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
 * @param {string} weekdayWorkLocation - 平日加班工作地點
 * @param {string} weekdayRemarks - 平日加班備註
 * @param {string} holidayWorkLocation - 例假日加班工作地點
 * @param {string} holidayRemarks - 例假日加班備註
 * @returns {Promise<void>}
 */
export async function generateExcelReport(
  weekdayReports: OvertimeReport[],
  holidayReports: OvertimeReport[],
  weekdayWorkLocation: string,
  weekdayRemarks: string,
  holidayWorkLocation: string,
  holidayRemarks: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // 取得員工資訊和年月
  const firstReport = weekdayReports[0] || holidayReports[0];
  if (!firstReport) {
    alert('沒有可用的記錄');
    return;
  }

  const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
  const yearMonth = getYearMonth(firstReport.date);

  // 生成平日加班工作表
  if (weekdayReports.length > 0) {
    createWorksheet(workbook, '平日加班', weekdayReports, employeeName, yearMonth, weekdayWorkLocation, weekdayRemarks);
  }

  // 生成例假日加班工作表
  if (holidayReports.length > 0) {
    createWorksheet(workbook, '例假日加班', holidayReports, employeeName, yearMonth, holidayWorkLocation, holidayRemarks);
  }

  // 下載檔案
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `員工加班申請表-${employeeName}-${yearMonth}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * 建立單個 Excel 工作表
 * @param {ExcelJS.Workbook} workbook - Excel 工作簿物件
 * @param {string} sheetName - 工作表名稱
 * @param {OvertimeReport[]} reports - 加班記錄陣列
 * @param {string} employeeName - 員工姓名
 * @param {string} yearMonth - 申請年月
 * @param {string} workLocation - 工作地點
 * @param {string} remarks - 備註
 */
function createWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  reports: OvertimeReport[],
  employeeName: string,
  yearMonth: string,
  workLocation: string,
  remarks: string
): void {
  const worksheet = workbook.addWorksheet(sheetName);

  // 標題行（合併儲存格，置中）
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = '海灣國際股份有限公司員工加班申請表';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // 申請年月行（合併儲存格，置中）
  worksheet.mergeCells('A2:F2');
  const yearMonthCell = worksheet.getCell('A2');
  yearMonthCell.value = `${yearMonth}`;
  yearMonthCell.font = { size: 12, bold: true };
  yearMonthCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  // 員工姓名（左對齊）
  worksheet.mergeCells('A3:C3');
  const nameCell = worksheet.getCell('A3');
  nameCell.value = `員工姓名：${employeeName}`;
  nameCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // 工作地點（左對齊）
  worksheet.mergeCells('D3:F3');
  const locationCell = worksheet.getCell('D3');
  locationCell.value = `工作地點：${workLocation}`;
  locationCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // 備註（左對齊）
  worksheet.mergeCells('A4:F4');
  const remarkCell = worksheet.getCell('A4');
  remarkCell.value = `備註：${remarks || ''}`;
  remarkCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // 表格標題（粗體、灰底）
  const headerRow = worksheet.addRow(['日期', '時間', '加班理由', '加班時數', '誤餐費', '合計']);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });

  // 資料列
  let totalOvertimeHours = 0;
  let totalMealAllowance = 0;

  reports.forEach((report) => {
    const row = worksheet.addRow([
      formatDateWithDayOfWeek(report.date),
      report.overtimeRange,
      report.overtimeReason || '',
      report.overtimeHours.toFixed(2),
      report.mealAllowance,
      '' // 合計欄位留空
    ]);

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    totalOvertimeHours += report.overtimeHours;
    totalMealAllowance += report.mealAllowance;
  });

  // 合計列
  // 暫時不顯示合計（根據範本）

  // 簽核欄（合併儲存格，左對齊）
  const signRow = worksheet.addRow(['']);
  worksheet.mergeCells(signRow.number, 1, signRow.number, 3);
  worksheet.mergeCells(signRow.number, 4, signRow.number, 6);
  const deptCell = worksheet.getCell(signRow.number, 1);
  const companyCell = worksheet.getCell(signRow.number, 4);
  deptCell.value = '部門主管：';
  companyCell.value = '公司主管：';
  deptCell.alignment = { horizontal: 'left', vertical: 'middle' };
  companyCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(signRow.number).height = 25;

  // 設定欄寬
  worksheet.getColumn(1).width = 12; // 日期
  worksheet.getColumn(2).width = 18; // 時間
  worksheet.getColumn(3).width = 30; // 加班理由
  worksheet.getColumn(4).width = 12; // 加班時數
  worksheet.getColumn(5).width = 10; // 誤餐費
  worksheet.getColumn(6).width = 10; // 合計
}

/**
 * 生成 PDF 報表（兩頁：平日加班、例假日加班）
 * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
 * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
 * @param {string} workLocation - 工作地點
 * @param {string} remarks - 備註
 * @returns {Promise<void>}
 */
export async function generatePdfReport(
  weekdayReports: OvertimeReport[],
  holidayReports: OvertimeReport[],
  weekdayWorkLocation: string,
  weekdayRemarks: string,
  holidayWorkLocation: string,
  holidayRemarks: string
): Promise<void> {
  const firstReport = weekdayReports[0] || holidayReports[0];
  if (!firstReport) {
    alert('沒有可用的記錄');
    return;
  }

  const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
  const yearMonth = getYearMonth(firstReport.date);

  // 建立隱藏的 HTML 容器
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.width = '210mm';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = '"Microsoft JhengHei", "Heiti TC", sans-serif';
  container.style.padding = '20mm';
  document.body.appendChild(container);

  const pdf = new jsPDF('p', 'mm', 'a4');
  let isFirstPdfPage = true;

  // 生成平日加班頁面（動態高度分頁）
  if (weekdayReports.length > 0) {
    const weekdayPages = paginateReportsByHeight(
      '平日加班',
      weekdayReports,
      employeeName,
      yearMonth,
      weekdayWorkLocation,
      weekdayRemarks,
      generatePageHtml
    );
    for (const pageData of weekdayPages) {
      container.innerHTML = generatePageHtml(
        '平日加班',
        pageData.reports,
        employeeName,
        yearMonth,
        weekdayWorkLocation,
        weekdayRemarks,
        pageData.pageNumber,
        pageData.totalPages,
        pageData.isFirstPage,
        pageData.isLastPage
      );
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      if (!isFirstPdfPage) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      isFirstPdfPage = false;
    }
  }

  // 生成例假日加班頁面（動態高度分頁，獨立編號）
  if (holidayReports.length > 0) {
    const holidayPages = paginateReportsByHeight(
      '例假日加班',
      holidayReports,
      employeeName,
      yearMonth,
      holidayWorkLocation,
      holidayRemarks,
      generatePageHtml
    );
    for (const pageData of holidayPages) {
      container.innerHTML = generatePageHtml(
        '例假日加班',
        pageData.reports,
        employeeName,
        yearMonth,
        holidayWorkLocation,
        holidayRemarks,
        pageData.pageNumber,
        pageData.totalPages,
        pageData.isFirstPage,
        pageData.isLastPage
      );
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      if (!isFirstPdfPage) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      isFirstPdfPage = false;
    }
  }

  // 清理
  document.body.removeChild(container);

  // 下載
  pdf.save(`員工加班申請表-${employeeName}-${yearMonth}.pdf`);
}

/**
 * 列印報表（兩頁：平日加班、例假日加班）
 * @param {OvertimeReport[]} weekdayReports - 平日加班記錄
 * @param {OvertimeReport[]} holidayReports - 例假日加班記錄
 * @param {string} workLocation - 工作地點
 * @param {string} remarks - 備註
 */
export function printReport(
  weekdayReports: OvertimeReport[],
  holidayReports: OvertimeReport[],
  weekdayWorkLocation: string,
  weekdayRemarks: string,
  holidayWorkLocation: string,
  holidayRemarks: string
): void {
  const firstReport = weekdayReports[0] || holidayReports[0];
  if (!firstReport) {
    alert('沒有可用的記錄');
    return;
  }

  const employeeName = `${firstReport.employeeId} ${firstReport.name}`;
  const yearMonth = getYearMonth(firstReport.date);

  let htmlContent = `
    <html>
      <head>
        <title>員工加班申請表</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { 
            font-family: "Microsoft JhengHei", "Heiti TC", sans-serif; 
            margin: 0; 
            padding: 0;
          }
          .page { 
            page-break-after: always; 
            padding: 20px;
          }
          .page:last-child {
            page-break-after: auto;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
  `;

  // 平日加班（動態高度分頁）
  if (weekdayReports.length > 0) {
    const weekdayPages = paginateReportsByHeight(
      '平日加班',
      weekdayReports,
      employeeName,
      yearMonth,
      weekdayWorkLocation,
      weekdayRemarks,
      generatePageHtml
    );
    weekdayPages.forEach(pageData => {
      htmlContent += `<div class="page">${generatePageHtml(
        '平日加班',
        pageData.reports,
        employeeName,
        yearMonth,
        weekdayWorkLocation,
        weekdayRemarks,
        pageData.pageNumber,
        pageData.totalPages,
        pageData.isFirstPage,
        pageData.isLastPage
      )}</div>`;
    });
  }

  // 例假日加班（動態高度分頁，獨立編號）
  if (holidayReports.length > 0) {
    const holidayPages = paginateReportsByHeight(
      '例假日加班',
      holidayReports,
      employeeName,
      yearMonth,
      holidayWorkLocation,
      holidayRemarks,
      generatePageHtml
    );
    holidayPages.forEach(pageData => {
      htmlContent += `<div class="page">${generatePageHtml(
        '例假日加班',
        pageData.reports,
        employeeName,
        yearMonth,
        holidayWorkLocation,
        holidayRemarks,
        pageData.pageNumber,
        pageData.totalPages,
        pageData.isFirstPage,
        pageData.isLastPage
      )}</div>`;
    });
  }

  htmlContent += `
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
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
}

/**
 * 生成單頁 HTML 內容（供 PDF 與列印使用）
 * @param {string} _title - 標題（保留參數供未來使用）
 * @param {OvertimeReport[]} reports - 加班記錄陣列
 * @param {string} employeeName - 員工姓名
 * @param {string} yearMonth - 申請年月
 * @param {string} workLocation - 工作地點
 * @param {string} remarks - 備註
 * @param {number} pageNumber - 頁碼
 * @returns {string} HTML 字串
 */
function generatePageHtml(
  _title: string,
  reports: OvertimeReport[],
  employeeName: string,
  yearMonth: string,
  workLocation: string,
  remarks: string,
  pageNumber: number,
  totalPages: number,
  isFirstPage: boolean,
  isLastPage: boolean
): string {
  let totalOvertimeHours = 0;
  let totalMealAllowance = 0;

  reports.forEach(report => {
    totalOvertimeHours += report.overtimeHours;
    totalMealAllowance += report.mealAllowance;
  });

  return `
    <div style="font-size: 12px;">
      <!-- 第一行：公司名稱（置中） -->
      <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px;">
        海灣國際股份有限公司
      </div>
      <!-- 第二行：申請表標題（置中，加底線）+ 申請年月（靠右） -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div style="flex: 1;"></div>
        <div style="text-align: center; font-size: 20px; font-weight: bold; text-decoration: underline; flex: 1;">
          員工加班申請表
        </div>
        <div style="text-align: right; font-size: 14px; flex: 1;">
          申請年月：${yearMonth}
        </div>
      </div>
      ${isFirstPage ? `<div style="margin-bottom: 15px; font-size: 14px;">
        <div style="margin-bottom: 5px;">員工姓名：${employeeName}</div>
        <div style="margin-bottom: 5px;">工作地點：${workLocation}</div>
        <div>備註：${remarks || ''}</div>
      </div>` : ''}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">日期</th>
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">時間</th>
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">加班理由</th>
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">加班時數</th>
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">誤餐費</th>
            <th style="border: 1px solid black; padding: 6px 8px; text-align: left; font-weight: bold;">合計</th>
          </tr>
        </thead>
        <tbody>
          ${reports.map(report => `
            <tr>
              <td style="border: 1px solid black; padding: 6px 8px;">${formatDateWithDayOfWeek(report.date)}</td>
              <td style="border: 1px solid black; padding: 6px 8px;">${report.overtimeRange}</td>
              <td style="border: 1px solid black; padding: 6px 8px;">${report.overtimeReason || ''}</td>
              <td style="border: 1px solid black; padding: 6px 8px;">${report.overtimeHours.toFixed(2)}</td>
              <td style="border: 1px solid black; padding: 6px 8px;">${report.mealAllowance}</td>
              <td style="border: 1px solid black; padding: 6px 8px;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${isLastPage ? `<div style="margin-top: 20px; font-size: 14px; display: flex; justify-content: space-between;">
        <div style="flex: 1;">部門主管：</div>
        <div style="flex: 1;">公司主管：</div>
      </div>` : ''}
      <div style="text-align: right; margin-top: 10px; font-size: 12px; color: #666;">
        頁碼：${pageNumber}/${totalPages}
      </div>
    </div>
  `;
}

