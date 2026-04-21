/**
 * 報表生成服務
 * 
 * 提供 Excel、PDF、列印報表的純邏輯函數
 * PDF／列印版面數值以 `0.standards/輸出列印字體放大設計.md` 為準（含頁邊距、區塊間距、頁尾堆疊與 16 列列表）。
 */

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { OvertimeReport } from '../types';
import { formatDate as formatDateWithDayOfWeek } from '../utils/dateFormatter';
import { normalizeOvertimeReasonForPrint } from '../utils/overtimeReasonFormatter';
import { paginateReportsByHeight } from './paginationService';

/**
 * PDF 表格內可換行文字的切行規則。
 * 目前只用於「加班理由」欄位，避免內容過長時撐破固定列高。
 */
const PDF_REASON_MAX_LENGTH = 200;
const PDF_REASON_CHARS_PER_ROW = 25;
/** 每頁固定 15 筆資料列；表頭另計 1 列。 */
const PDF_DATA_ROWS_PER_PAGE = 15;
/**
 * A4 可列印區的外框規格。
 * - mm 常數對應列印頁邊界
 * - px 常數對應 HTML 畫面中的區塊間距
 */
const PDF_MARGIN_TOP_MM = 7.35;
const PDF_MARGIN_BOTTOM_MM = 6;
const PDF_MARGIN_X_MM = 10;
const PDF_BLOCK_GAP_PX = 8;
/** px / mm 換算基準，依 96 DPI 計算。 */
const PDF_PX_PER_MM = 96 / 25.4;
/**
 * 頁首兩大標題的相對位置規格。
 * `PDF_GAP_COMPANY_TO_FORM_TITLE_PX` 是實際生效的兩標題間距；
 * `PDF_TITLE_STACK_RESERVED_GAP_PX` 是標題堆疊區預留高度，用來鎖住列表起點。
 */
/**
 * 兩大標題間距（海灣…與員工加班申請表）。
 * 此值只影響標題堆疊區內部兩行標題的相對距離，
 * 不應再連動到上方區塊與列表之間的位置。
 */
const PDF_GAP_COMPANY_TO_FORM_TITLE_PX = 8;
/** 表單標題列與「員工姓名」區塊之間距：原 10px 之半 */
const PDF_TITLE_ROW_MARGIN_BOTTOM_PX = 5;
/** 兩大標題本身的文字區高度。 */
const PDF_COMPANY_TITLE_HEIGHT_PX = 24;
const PDF_FORM_TITLE_ROW_HEIGHT_PX = 24;
/**
 * 標題堆疊區保留固定高度，避免調整兩大標題間距時把整個列表往下推。
 * 目前預留 24px 間距空間，足以容納現行 `PDF_GAP_COMPANY_TO_FORM_TITLE_PX`。
 */
const PDF_TITLE_STACK_RESERVED_GAP_PX = 24;
/** 標題堆疊區總高：公司標題 + 保留間距 + 表單標題列 + 與資訊區的間距。 */
const PDF_TITLE_STACK_HEIGHT_PX =
  PDF_COMPANY_TITLE_HEIGHT_PX +
  PDF_TITLE_STACK_RESERVED_GAP_PX +
  PDF_FORM_TITLE_ROW_HEIGHT_PX +
  PDF_TITLE_ROW_MARGIN_BOTTOM_PX;
/**
 * 頁首資訊區的行高規格。
 * - `PDF_INFO_LINE_*` 用於員工姓名、工作地點
 * - `PDF_REMARK_LINE_HEIGHT_PX` 用於 3 條備註底線
 */
const PDF_INFO_LINE_HEIGHT_PX = 19;
const PDF_INFO_LINE_MARGIN_BOTTOM_PX = 3;
const PDF_REMARK_LINE_HEIGHT_PX = 24;
/** 上方固定資訊區總高：標題堆疊 + 兩行資訊 + 三行備註。 */
const PDF_TOP_SECTION_HEIGHT_PX =
  PDF_TITLE_STACK_HEIGHT_PX +
  (PDF_INFO_LINE_HEIGHT_PX + PDF_INFO_LINE_MARGIN_BOTTOM_PX) * 2 +
  PDF_REMARK_LINE_HEIGHT_PX * 3;
/** 單頁可用高度：A4 全高扣除上下邊界。 */
const PDF_PRINT_PAGE_HEIGHT_MM = 297 - PDF_MARGIN_TOP_MM - PDF_MARGIN_BOTTOM_MM;
const PDF_PRINT_PAGE_HEIGHT_PX = PDF_PRINT_PAGE_HEIGHT_MM * PDF_PX_PER_MM;
/**
 * 表格區與頁尾區的固定高度規格。
 * 這些常數共同決定中間列表區還剩多少空間可分配給 15 列資料。
 */
/** 列表表頭固定高度；45px 可完整顯示兩行表頭文字。 */
const PDF_TABLE_HEADER_HEIGHT_PX = 45;
/** 頁尾區塊固定高度：簽名區在上，頁碼區在下。 */
const PDF_SIGNATURE_AREA_HEIGHT_PX = 88;
const PDF_PAGE_NUMBER_HEIGHT_PX = 26;
/** 預留給表格最底邊框的高度，避免最後一列底線剛好落在裁切邊界。 */
const PDF_TABLE_BOTTOM_BORDER_RESERVED_PX = 1;
/** 中間列表區總高：頁面可用高度扣除上方資訊區、上下區塊間距與頁尾。 */
const PDF_TABLE_AREA_HEIGHT_PX =
  PDF_PRINT_PAGE_HEIGHT_PX -
  PDF_TOP_SECTION_HEIGHT_PX -
  PDF_BLOCK_GAP_PX * 2 -
  PDF_SIGNATURE_AREA_HEIGHT_PX -
  PDF_PAGE_NUMBER_HEIGHT_PX;
/** 資料列固定高：先扣表頭與表格底線保留值，再由 15 列平均分配剩餘高度。 */
const PDF_TABLE_BODY_ROW_HEIGHT_PX =
  (PDF_TABLE_AREA_HEIGHT_PX - PDF_TABLE_HEADER_HEIGHT_PX - PDF_TABLE_BOTTOM_BORDER_RESERVED_PX) / PDF_DATA_ROWS_PER_PAGE;
/**
 * 預覽與 PDF 共用的欄位長度限制。
 * 這組常數會匯出給 `PreviewModal` 與驗證邏輯，確保畫面與輸出規則一致。
 */
export const REPORT_WORK_LOCATION_MAX_CHARS = 40;
export const REPORT_REMARK_LINE_CHARS = 40;
export const REPORT_REMARK_MAX_CHARS = 120;
export const REPORT_REMARK_LINES = 3;

/**
 * PDF 端沿用共用長度規格的別名。
 * 保留獨立常數名稱，可讓 PDF 相關函式在語意上直接表達用途，
 * 同時避免未來若預覽與輸出規格拆分時需要大範圍改名。
 */
const PDF_REMARK_MAX_LENGTH = REPORT_REMARK_MAX_CHARS;
const PDF_REMARK_LINE_LENGTH = REPORT_REMARK_LINE_CHARS;
const PDF_REMARK_TOTAL_LINES = REPORT_REMARK_LINES;

/**
 * 工作地點單行化並截斷為 PDF／Excel 上限字數（與預覽驗證一致）
 */
function normalizeWorkLocationForExport(location: string): string {
  return Array.from((location || '').replace(/\r?\n/g, '')).slice(0, REPORT_WORK_LOCATION_MAX_CHARS).join('');
}

/**
 * 由民國日期字串萃取申請年月，供檔名與表頭使用。
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
 * 將備註切成固定三列，對齊紙本表單的手寫欄位。
 */
function splitRemarkToFixedLines(remark: string): string[] {
  const normalized = Array.from((remark || '').replace(/\r?\n/g, '')).slice(0, PDF_REMARK_MAX_LENGTH);
  const lines: string[] = [];
  for (let i = 0; i < PDF_REMARK_TOTAL_LINES; i++) {
    const start = i * PDF_REMARK_LINE_LENGTH;
    const end = start + PDF_REMARK_LINE_LENGTH;
    lines.push(normalized.slice(start, end).join(''));
  }
  return lines;
}

/**
 * 將加班理由先轉為輸出用全型文字，再切成表格可容納的多列文字。
 */
function getReasonLines(reason: string): string[] {
  const normalized = Array.from(normalizeOvertimeReasonForPrint(reason || '').trim()).slice(0, PDF_REASON_MAX_LENGTH);
  if (normalized.length === 0) return [''];

  const lines: string[] = [];
  for (let i = 0; i < normalized.length; i += PDF_REASON_CHARS_PER_ROW) {
    lines.push(normalized.slice(i, i + PDF_REASON_CHARS_PER_ROW).join(''));
  }
  return lines;
}

/**
 * 將「日期 + 星期」拆開，方便在 PDF 儲存格內上下排列。
 */
function getDateParts(formattedDate: string): { dateText: string; weekdayText: string } {
  const parts = formattedDate.split(' ');
  if (parts.length >= 2) {
    return {
      dateText: parts.slice(0, -1).join(' '),
      weekdayText: parts[parts.length - 1]
    };
  }
  return { dateText: formattedDate, weekdayText: '' };
}

/**
 * 將 `HH:mm - HH:mm` 拆成上下兩列顯示的起訖時間。
 */
function getTimeParts(overtimeRange: string): { startText: string; endText: string } {
  const match = overtimeRange.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!match) {
    return { startText: overtimeRange, endText: '' };
  }

  return {
    startText: `${match[1]} ~`,
    endText: match[2]
  };
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
  locationCell.value = `工作地點：${normalizeWorkLocationForExport(workLocation)}`;
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
 * 將 html2canvas 產生的影像置入 PDF 單頁；若換算高度超過 A4，則等比縮放以完整顯示（避免最後一列被裁切）。
 */
function addCanvasPageToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, isFirstPage: boolean): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/png');
  let renderW = pageWidth;
  let renderH = (canvas.height * renderW) / canvas.width;
  if (renderH > pageHeight) {
    renderH = pageHeight;
    renderW = (canvas.width * renderH) / canvas.height;
  }
  const x = (pageWidth - renderW) / 2;
  if (!isFirstPage) {
    pdf.addPage();
  }
  pdf.addImage(imgData, 'PNG', x, 0, renderW, renderH);
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
  container.style.boxSizing = 'border-box';
  container.style.width = '210mm';
  container.style.height = '297mm';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = '"Microsoft JhengHei", "Heiti TC", sans-serif';
  container.style.padding = `${PDF_MARGIN_TOP_MM}mm ${PDF_MARGIN_X_MM}mm ${PDF_MARGIN_BOTTOM_MM}mm ${PDF_MARGIN_X_MM}mm`;
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
      addCanvasPageToPdf(pdf, canvas, isFirstPdfPage);
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
      addCanvasPageToPdf(pdf, canvas, isFirstPdfPage);
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
          @page { size: A4; margin: ${PDF_MARGIN_TOP_MM}mm ${PDF_MARGIN_X_MM}mm ${PDF_MARGIN_BOTTOM_MM}mm ${PDF_MARGIN_X_MM}mm; }
          body { 
            font-family: "Microsoft JhengHei", "Heiti TC", sans-serif; 
            margin: 0; 
            padding: 0;
          }
          .page { 
            page-break-after: always; 
            box-sizing: border-box;
            width: 100%;
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
      htmlContent += `<div class="page" style="display:flex;flex-direction:column;box-sizing:border-box;width:100%;height:${PDF_PRINT_PAGE_HEIGHT_MM}mm;">${generatePageHtml(
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
      htmlContent += `<div class="page" style="display:flex;flex-direction:column;box-sizing:border-box;width:100%;height:${PDF_PRINT_PAGE_HEIGHT_MM}mm;">${generatePageHtml(
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
 * 生成單頁 HTML 內容（供 PDF 與列印共用）
 * @param {string} _title - 報表區塊標題（保留參數供未來版型擴充）
 * @param {OvertimeReport[]} reports - 加班記錄陣列
 * @param {string} employeeName - 員工姓名
 * @param {string} yearMonth - 申請年月
 * @param {string} workLocation - 工作地點
 * @param {string} remarks - 備註
 * @param {number} pageNumber - 頁碼
 * @param {number} totalPages - 總頁數
 * @param {boolean} isFirstPage - 是否為第一頁
 * @param {boolean} isLastPage - 是否為最後一頁
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
  void isFirstPage;
  void isLastPage;
  const remarkLines = splitRemarkToFixedLines(remarks);
  const normalizedReports = [...reports];
  const workLocationDisplay = normalizeWorkLocationForExport(workLocation);

  /** 列表儲存格：框線改為每條線只畫一次，避免 collapse 合併後的粗細視覺差異。 */
  const cellBase =
    'border-right: 1px solid black; border-bottom: 1px solid black; padding: 2px 6px; line-height: 1; font-size: 14px; box-sizing: border-box;';
  const bodyCellBase =
    `${cellBase} height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; min-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; max-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; overflow: hidden;`;
  const cellSingleLine = `${bodyCellBase} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
  const tableHeaderThStyle =
    `${cellBase} text-align: center; vertical-align: top; font-weight: bold; height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; min-height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; max-height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; padding-top: 1px; padding-bottom: 0; overflow: hidden;`;

  return `
    <div style="height: 100%; min-height: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; font-size: 14px; color: #1f2f44;">
      <div style="flex: 0 0 ${PDF_TOP_SECTION_HEIGHT_PX}px; height: ${PDF_TOP_SECTION_HEIGHT_PX}px;">
        <div style="position: relative; height: ${PDF_TITLE_STACK_HEIGHT_PX}px;">
          <div style="height: ${PDF_COMPANY_TITLE_HEIGHT_PX}px; text-align: center; font-size: 24px; line-height: 1; font-weight: bold;">
            海灣國際股份有限公司
          </div>
          <div style="position: absolute; left: 0; right: 0; top: ${PDF_COMPANY_TITLE_HEIGHT_PX + PDF_GAP_COMPANY_TO_FORM_TITLE_PX}px; height: ${PDF_FORM_TITLE_ROW_HEIGHT_PX}px; display: flex; justify-content: space-between; align-items: center; line-height: 1; padding-bottom: ${PDF_TITLE_ROW_MARGIN_BOTTOM_PX}px; box-sizing: border-box;">
            <div style="flex: 1;"></div>
            <div style="text-align: center; font-size: 24px; font-weight: bold; text-decoration: underline; flex: 1;">
              員工加班申請表
            </div>
            <div style="text-align: right; font-size: 16px; flex: 1;">
              申請年月：${yearMonth}
            </div>
          </div>
        </div>
        <div style="font-size: 16px;">
          <div style="height: ${PDF_INFO_LINE_HEIGHT_PX}px; line-height: ${PDF_INFO_LINE_HEIGHT_PX}px; margin-bottom: ${PDF_INFO_LINE_MARGIN_BOTTOM_PX}px;">員工姓名：${employeeName}</div>
          <div style="height: ${PDF_INFO_LINE_HEIGHT_PX}px; line-height: ${PDF_INFO_LINE_HEIGHT_PX}px; margin-bottom: ${PDF_INFO_LINE_MARGIN_BOTTOM_PX}px;">工作地點：${workLocationDisplay}</div>
          <div>
            <div style="display: flex; align-items: center; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">
              <span style="display: inline-block; width: 52px;">備註：</span>
              <span style="flex: 1; border-bottom: 1px solid #000; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">${remarkLines[0]}</span>
            </div>
            <div style="display: flex; align-items: center; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">
              <span style="display: inline-block; width: 52px;"></span>
              <span style="flex: 1; border-bottom: 1px solid #000; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">${remarkLines[1]}</span>
            </div>
            <div style="display: flex; align-items: center; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">
              <span style="display: inline-block; width: 52px;"></span>
              <span style="flex: 1; border-bottom: 1px solid #000; height: ${PDF_REMARK_LINE_HEIGHT_PX}px; min-height: ${PDF_REMARK_LINE_HEIGHT_PX}px; line-height: ${PDF_REMARK_LINE_HEIGHT_PX}px;">${remarkLines[2]}</span>
            </div>
          </div>
        </div>
      </div>
      <div style="flex: 0 0 auto; height: ${PDF_BLOCK_GAP_PX}px; min-height: ${PDF_BLOCK_GAP_PX}px;"></div>
      <div style="flex: 0 0 ${PDF_TABLE_AREA_HEIGHT_PX}px; height: ${PDF_TABLE_AREA_HEIGHT_PX}px; min-height: ${PDF_TABLE_AREA_HEIGHT_PX}px; overflow: hidden; position: relative; width: 100%;">
        <table style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; width: 100%; height: ${PDF_TABLE_AREA_HEIGHT_PX}px; border-collapse: separate; border-spacing: 0; border-top: 1px solid black; border-left: 1px solid black; border-bottom: 1px solid black; box-sizing: border-box; font-size: 14px; table-layout: fixed;">
          <colgroup>
            <col style="width: 14%;">
            <col style="width: 10%;">
            <col style="width: 53%;">
            <col style="width: 9%;">
            <col style="width: 8%;">
            <col style="width: 6%;">
          </colgroup>
          <thead>
            <tr style="background-color: #f0f0f0; height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; min-height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; max-height: ${PDF_TABLE_HEADER_HEIGHT_PX}px; box-sizing: border-box;">
              <th style="${tableHeaderThStyle}">日期</th>
              <th style="${tableHeaderThStyle}">時間</th>
              <th style="${tableHeaderThStyle}">加班理由</th>
              <th style="${tableHeaderThStyle}">加班<br>時數</th>
              <th style="${tableHeaderThStyle}">誤餐費</th>
              <th style="${tableHeaderThStyle}">合計</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let usedRows = 0;
              let rowsHtml = '';

              for (const report of normalizedReports) {
                const formattedDate = formatDateWithDayOfWeek(report.date);
                const { dateText, weekdayText } = getDateParts(formattedDate);
                const { startText, endText } = getTimeParts(report.overtimeRange);
                const reasonLines = getReasonLines(report.overtimeReason || '');

                for (let lineIndex = 0; lineIndex < reasonLines.length; lineIndex++) {
                  const isFirstLine = lineIndex === 0;

                  rowsHtml += `
                  <tr style="height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; min-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; max-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px;">
                    <td style="${cellSingleLine} vertical-align: top;">
                      ${isFirstLine ? `${dateText}${weekdayText ? `<br>${weekdayText}` : ''}` : ''}
                    </td>
                    <td style="${cellSingleLine} vertical-align: top;">
                      ${isFirstLine ? `${startText}${endText ? `<br>${endText}` : ''}` : ''}
                    </td>
                    <td style="${cellSingleLine} vertical-align: top;">
                      ${reasonLines[lineIndex]}
                    </td>
                    <td style="${cellSingleLine} vertical-align: top;">
                      ${isFirstLine ? report.overtimeHours.toFixed(2) : ''}
                    </td>
                    <td style="${cellSingleLine} vertical-align: top;">
                      ${isFirstLine ? report.mealAllowance : ''}
                    </td>
                    <td style="${bodyCellBase} vertical-align: top;"></td>
                  </tr>
                `;
                  usedRows++;
                }
              }

              rowsHtml += Array.from({ length: Math.max(PDF_DATA_ROWS_PER_PAGE - usedRows, 0) })
                .map(
                  () => `
                <tr style="height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; min-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px; max-height: ${PDF_TABLE_BODY_ROW_HEIGHT_PX}px;">
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                  <td style="${bodyCellBase} vertical-align: top;"></td>
                </tr>
              `
                )
                .join('');

              return rowsHtml;
            })()}
          </tbody>
        </table>
      </div>
      <div style="flex: 0 0 auto; height: ${PDF_BLOCK_GAP_PX}px; min-height: ${PDF_BLOCK_GAP_PX}px;"></div>
      <div style="flex: 0 0 auto; height: ${PDF_SIGNATURE_AREA_HEIGHT_PX}px; box-sizing: border-box; display: flex; justify-content: space-between; align-items: flex-start; padding-top: 4px; font-size: 16px;">
        <div style="flex: 1;">部門主管：</div>
        <div style="flex: 1;">公司主管：</div>
      </div>
      <div style="flex: 0 0 auto; height: ${PDF_PAGE_NUMBER_HEIGHT_PX}px; box-sizing: border-box; display: flex; align-items: flex-end; justify-content: flex-end; font-size: 13px; color: #666;">
        頁碼：${pageNumber}/${totalPages}
      </div>
    </div>
  `;
}

