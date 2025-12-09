import type { OvertimeReport } from '../types';

export interface PageData {
  pageNumber: number;
  totalPages: number;
  reports: OvertimeReport[];
  isFirstPage: boolean;
  isLastPage: boolean;
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
 * 將報表記錄分頁（新版：動態高度檢測）
 * 
 * 此函數會實際測量每頁內容的渲染高度，確保不超過 A4 頁面限制
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

  // A4 頁面高度限制（px）
  // 297mm - 40mm (上下邊距) = 257mm ≈ 970px at 96dpi
  // 設定為 950px 預留誤差空間
  const MAX_PAGE_HEIGHT = 950;
  
  const pages: PageData[] = [];
  
  // 建立隱藏測量容器
  const measureContainer = document.createElement('div');
  measureContainer.style.position = 'fixed';
  measureContainer.style.top = '-10000px';
  measureContainer.style.left = '-10000px';
  measureContainer.style.width = '210mm'; // A4 寬度
  measureContainer.style.visibility = 'hidden';
  measureContainer.style.pointerEvents = 'none';
  document.body.appendChild(measureContainer);

  let currentPageReports: OvertimeReport[] = [];
  let pageIndex = 0;

  try {
    for (let i = 0; i < reports.length; i++) {
      // 嘗試加入這筆記錄
      const testReports = [...currentPageReports, reports[i]];
      
      // 生成測試 HTML
      const isFirstPage = pageIndex === 0;
      const isLastPage = i === reports.length - 1;
      const testHtml = generateHtmlFunc(
        reportType,
        testReports,
        employeeName,
        yearMonth,
        workLocation,
        remarks,
        pageIndex + 1,
        999, // 暫時的總頁數
        isFirstPage,
        isLastPage
      );
      
      measureContainer.innerHTML = testHtml;
      
      // 強制瀏覽器重新計算佈局
      measureContainer.offsetHeight;
      
      const currentHeight = measureContainer.offsetHeight;
      
      // 檢查是否超過高度限制
      if (currentHeight > MAX_PAGE_HEIGHT && currentPageReports.length > 0) {
        // 超過了，將目前頁面儲存
        pages.push({
          pageNumber: pageIndex + 1,
          totalPages: 0,
          reports: [...currentPageReports],
          isFirstPage: pageIndex === 0,
          isLastPage: false
        });
        
        // 開始新頁面，將當前記錄作為新頁的第一筆
        currentPageReports = [reports[i]];
        pageIndex++;
      } else {
        // 未超過，加入這筆記錄
        currentPageReports.push(reports[i]);
      }
    }

    // 加入最後一頁
    if (currentPageReports.length > 0) {
      pages.push({
        pageNumber: pageIndex + 1,
        totalPages: 0,
        reports: currentPageReports,
        isFirstPage: pageIndex === 0,
        isLastPage: true
      });
    }
  } finally {
    // 確保清理測量容器（即使發生錯誤）
    if (document.body.contains(measureContainer)) {
      document.body.removeChild(measureContainer);
    }
  }

  // 更新總頁數
  const totalPages = pages.length;
  pages.forEach(page => {
    page.totalPages = totalPages;
    page.isLastPage = page.pageNumber === totalPages;
  });

  return pages;
}

