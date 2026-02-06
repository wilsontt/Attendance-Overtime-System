/**
 * 日期格式化工具模組
 * 
 * 用途：將民國年或西元年格式轉換為友善的顯示格式
 */

/**
 * 將日期字串格式化為顯示格式（西元年 + 簡寫星期）
 * @param dateStr - 日期字串（民國年 7 位數字：1141001 或西元格式）
 * @returns 格式化後的日期字串（如：2025/10/01 週三）
 */
export function formatDate(dateStr: string): string {
  // 解析民國年格式 (例如: 1141001)
  if (/^\d{7}$/.test(dateStr)) {
    const rocYear = parseInt(dateStr.substring(0, 3));
    const month = parseInt(dateStr.substring(3, 5));
    const day = parseInt(dateStr.substring(5, 7));
    const year = rocYear + 1911;
    const date = new Date(year, month - 1, day);
    
    // 檢查日期是否有效
    if (isNaN(date.getTime())) {
      return dateStr; // 無效日期，返回原始字串
    }
    
    // 取得星期幾
    const dayOfWeek = date.getDay();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const dayName = `週${dayNames[dayOfWeek]}`;
    
    // 格式化日期（西元年）
    const displayMonth = String(month).padStart(2, '0');
    const displayDay = String(day).padStart(2, '0');
    
    return `${year}/${displayMonth}/${displayDay} ${dayName}`;
  }
  
  // 如果是其他格式，嘗試解析
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const dayOfWeek = date.getDay();
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const dayName = `週${dayNames[dayOfWeek]}`;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${dayName}`;
  }
  
  // 無法解析，返回原始字串
  return dateStr;
}

/**
 * 將日期字串格式化為2列 HTML 顯示格式
 * @param dateStr - 日期字串（民國年 7 位數字：1141001 或西元格式）
 * @returns 格式化後的 HTML 字串（第一列：日期，第二列：星期）
 */
export function formatDateWithTwoLines(dateStr: string): string {
  let datePart = '';
  let dayOfWeekPart = '';
  
  // 解析民國年格式 (例如: 1141001)
  if (/^\d{7}$/.test(dateStr)) {
    const rocYear = parseInt(dateStr.substring(0, 3));
    const month = parseInt(dateStr.substring(3, 5));
    const day = parseInt(dateStr.substring(5, 7));
    const year = rocYear + 1911;
    const date = new Date(year, month - 1, day);
    
    // 檢查日期是否有效
    if (!isNaN(date.getTime())) {
      // 取得星期幾
      const dayOfWeek = date.getDay();
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
      dayOfWeekPart = `週${dayNames[dayOfWeek]}`;
      
      // 格式化日期（西元年）
      const displayMonth = String(month).padStart(2, '0');
      const displayDay = String(day).padStart(2, '0');
      datePart = `${year}/${displayMonth}/${displayDay}`;
    } else {
      return dateStr; // 無效日期，返回原始字串
    }
  } else {
    // 如果是其他格式，嘗試解析
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const dayOfWeek = date.getDay();
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
      dayOfWeekPart = `週${dayNames[dayOfWeek]}`;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      datePart = `${year}/${month}/${day}`;
    } else {
      return dateStr; // 無法解析，返回原始字串
    }
  }
  
  return `<div>${datePart}</div><div>${dayOfWeekPart}</div>`;
}

/**
 * 將時間範圍字串格式化為2列 HTML 顯示格式
 * @param timeRange - 時間範圍字串（格式：HH:mm-HH:mm，如「18:00-20:30」）
 * @returns 格式化後的 HTML 字串（第一列：開始時間-，第二列：結束時間）
 */
export function formatTimeRangeWithTwoLines(timeRange: string): string {
  if (!timeRange) return '<div></div><div></div>';
  
  // 解析時間範圍（格式：HH:mm-HH:mm）
  const parts = timeRange.split('-');
  if (parts.length === 2) {
    const startTime = parts[0].trim();
    const endTime = parts[1].trim();
    return `<div>${startTime}-</div><div>${endTime}</div>`;
  }
  
  // 如果格式不符合預期，返回原始字串（分為2列）
  return `<div>${timeRange}</div><div></div>`;
}

