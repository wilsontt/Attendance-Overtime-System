/**
 * 報表分頁服務。
 *
 * 這個模組專門處理「一頁能放幾筆資料」的規則，避免 Excel / PDF /
 * 列印流程各自維護一套分頁邏輯。
 */
import type { OvertimeReport } from '../types';
import { normalizeOvertimeReasonForPrint } from '../utils/overtimeReasonFormatter';

/**
 * 單一頁面的分頁結果。
 */
export interface PageData {
  /** 目前頁碼，從 1 開始。 */
  pageNumber: number;
  /** 該批資料的總頁數。 */
  totalPages: number;
  /** 這一頁實際要渲染的報表資料。 */
  reports: OvertimeReport[];
  /** 是否為第一頁，供樣板控制頁首行為。 */
  isFirstPage: boolean;
  /** 是否為最後一頁，供樣板控制頁尾行為。 */
  isLastPage: boolean;
}

/** 固定版型下，表格主體最多容納 15 列資料高度。 */
const DATA_ROWS_PER_PAGE = 15;
/** 加班理由與預覽驗證保持一致，避免分頁與實際輸出不一致。 */
const REASON_MAX_LENGTH = 200;
const REASON_CHARS_PER_ROW = 25;

/**
 * 估算單筆加班理由在 PDF / 列印輸出時會占用幾列。
 */
function getReasonRows(reason: string): number {
  const normalizedLength = Array.from(normalizeOvertimeReasonForPrint(reason || '').trim()).slice(0, REASON_MAX_LENGTH).length;
  return Math.max(1, Math.ceil(normalizedLength / REASON_CHARS_PER_ROW));
}

/**
 * 將報表記錄分頁（舊版：固定行數分頁，保留作為備用）
 * @param reports - 報表記錄陣列
 * @returns 分頁後的資料陣列
 */
export function paginateReports(reports: OvertimeReport[]): PageData[] {
  if (reports.length === 0) return [];
  
  const FIRST_PAGE_MAX_ROWS = 15; // 第一頁最多 15 筆
  const OTHER_PAGE_MAX_ROWS = 18; // 後續頁最多 18 筆
  
  const pages: PageData[] = [];
  let currentPage: OvertimeReport[] = [];
  let pageIndex = 0;
  
  reports.forEach((report) => {
    const maxRows = pageIndex === 0 ? FIRST_PAGE_MAX_ROWS : OTHER_PAGE_MAX_ROWS;
    
    if (currentPage.length >= maxRows) {
      // 當前頁已滿，切到下一頁
      pages.push({
        pageNumber: pageIndex + 1,
        totalPages: 0,
        reports: [...currentPage],
        isFirstPage: pageIndex === 0,
        isLastPage: false
      });
      currentPage = [];
      pageIndex++;
    }
    
    currentPage.push(report);
  });
  
  // 加入最後一頁
  if (currentPage.length > 0) {
    pages.push({
      pageNumber: pageIndex + 1,
      totalPages: 0,
      reports: currentPage,
      isFirstPage: pageIndex === 0,
      isLastPage: true
    });
  }
  
  // 更新總頁數
  const totalPages = pages.length;
  pages.forEach(page => {
    page.totalPages = totalPages;
    page.isLastPage = page.pageNumber === totalPages;
  });
  
  return pages;
}

/**
 * 依「加班理由換行後占用列數」做分頁。
 *
 * 這裡不是直接量 DOM 高度，而是以固定列高模型預先估算，讓 PDF 與列印
 * 都能共用相同結果，避免某一筆理由太長把下一列擠出頁面。
 *
 * @param reportType - 報表類型（'平日加班' 或 '例假日加班'）
 * @param reports - 報表記錄陣列
 * @param employeeName - 員工姓名
 * @param yearMonth - 申請年月
 * @param workLocation - 工作地點
 * @param remarks - 備註
 * @param generateHtmlFunc - 生成 HTML 的函數
 * @returns 分頁後的資料陣列
 */
export function paginateReportsByHeight(
  reportType: '平日加班' | '例假日加班',
  reports: OvertimeReport[],
  employeeName: string,
  yearMonth: string,
  workLocation: string,
  remarks: string,
  generateHtmlFunc: (
    reportType: string,
    reports: OvertimeReport[],
    employeeName: string,
    yearMonth: string,
    workLocation: string,
    remarks: string,
    pageNumber: number,
    totalPages: number,
    isFirstPage: boolean,
    isLastPage: boolean
  ) => string
): PageData[] {
  if (reports.length === 0) return [];
  void reportType;
  void employeeName;
  void yearMonth;
  void workLocation;
  void remarks;
  void generateHtmlFunc;

  const pages: PageData[] = [];

  let currentPageReports: OvertimeReport[] = [];
  let remainingRows = DATA_ROWS_PER_PAGE;

  for (const report of reports) {
    const usedRows = getReasonRows(report.overtimeReason || '');

    if (usedRows > remainingRows && currentPageReports.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        totalPages: 0,
        reports: [...currentPageReports],
        isFirstPage: pages.length === 0,
        isLastPage: false
      });
      currentPageReports = [];
      remainingRows = DATA_ROWS_PER_PAGE;
    }

    currentPageReports.push(report);
    remainingRows -= usedRows;
  }

  if (currentPageReports.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      totalPages: 0,
      reports: [...currentPageReports],
      isFirstPage: pages.length === 0,
      isLastPage: false
    });
  }

  // 更新總頁數
  const totalPages = pages.length;
  pages.forEach(page => {
    page.totalPages = totalPages;
    page.isLastPage = page.pageNumber === totalPages;
  });

  return pages;
}

