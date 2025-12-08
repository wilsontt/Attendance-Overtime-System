import type { AttendanceRecord } from '../types';

/**
 * TXT 檔案解析服務
 * 
 * 用途：將固定寬度格式的出勤刷卡記錄 TXT 檔案內容解析為 AttendanceRecord[]
 */

interface ParsedRecord {
  employeeId: string;
  name: string;
  date: string;
  attendanceType: string;
  leaveQuantity: number;
  clockIn: string;
  clockOut: string;
}

/**
 * 解析 TXT 檔案的單一記錄區塊
 * @param lines - 記錄區塊的行陣列
 * @returns 解析後的記錄物件
 */
function parseRecord(lines: string[]): ParsedRecord | null {
  if (lines.length === 0) return null;

  const result: ParsedRecord = {
    employeeId: '',
    name: '',
    date: '',
    attendanceType: '',
    leaveQuantity: 0,
    clockIn: '',
    clockOut: ''
  };

  // 解析第一行：員工姓名和歸屬日期
  const firstLine = lines[0];
  
  // 提取員工編號和姓名（格式：100057 鄒東良）
  const nameMatch = firstLine.match(/(\d{6})\s+([\u4e00-\u9fa5]+)/);
  if (nameMatch) {
    result.employeeId = nameMatch[1];
    result.name = nameMatch[2];
  }

  // 提取歸屬日期（格式：1141101 或 1141104/1）
  const dateMatch = firstLine.match(/(\d{7})(?:\/\d)?/);
  if (dateMatch) {
    result.date = dateMatch[1];
  }

  // 提取考勤別和數量（格式：病假/1日//1141103  - 1141103）
  const leaveMatch = firstLine.match(/(事假|病假|請年休假|公假)\/(\d+(?:\.\d+)?)日/);
  if (leaveMatch) {
    result.attendanceType = leaveMatch[1];
    result.leaveQuantity = parseFloat(leaveMatch[2]);
  }

  // 提取刷卡時間
  const times: string[] = [];
  
  for (const line of lines) {
    // 匹配刷卡時間（格式：1141104 08:38 或在行尾）
    // 格式1: "1141104 08:38    正常" 或 "1141104 08:38    異常"
    const timeMatch = line.match(/\d{7}\s+(\d{2}:\d{2})\s+(?:正常|異常)/);
    if (timeMatch) {
      times.push(timeMatch[1]);
    }
  }

  // 第一個時間是上班時間，第二個是下班時間
  result.clockIn = times[0] || '';
  result.clockOut = times[1] || '';

  return result;
}

/**
 * 將 TXT 檔案內容解析為 AttendanceRecord 陣列
 * @param content - TXT 檔案內容（字串）
 * @returns AttendanceRecord 陣列
 * @throws Error 如果格式錯誤
 */
export function parseTxtContent(content: string): AttendanceRecord[] {
  // 格式驗證：檢查內容是否為空
  if (!content || content.trim() === '') {
    throw new Error('TXT 檔案內容為空，請確認檔案格式是否正確。');
  }

  const lines = content.split('\n');
  const records: AttendanceRecord[] = [];
  let currentRecord: string[] = [];
  let isDataSection = false;
  let hasHeaderRow = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 判斷是否開始資料區段（跳過標題）
    if (line.includes('員工姓名') && line.includes('歸屬日期')) {
      isDataSection = true;
      hasHeaderRow = true;
      continue;
    }

    // 跳過分隔線和空白行
    if (line.includes('====') || line.includes('... 接下頁 ...') || line.trim() === '') {
      if (currentRecord.length > 0) {
        const parsed = parseRecord(currentRecord);
        if (parsed && parsed.employeeId) {
          records.push({
            employeeId: parsed.employeeId,
            name: parsed.name,
            date: parsed.date,
            attendanceType: parsed.attendanceType || '',
            leaveQuantity: parsed.leaveQuantity || 0,
            clockIn: parsed.clockIn,
            clockOut: parsed.clockOut,
          });
        }
        currentRecord = [];
      }
      continue;
    }

    // 收集記錄行（檢查是否包含員工編號模式）
    if (isDataSection && /\d{6}\s+[\u4e00-\u9fa5]+/.test(line)) {
      // 新記錄開始
      if (currentRecord.length > 0) {
        const parsed = parseRecord(currentRecord);
        if (parsed && parsed.employeeId) {
          records.push({
            employeeId: parsed.employeeId,
            name: parsed.name,
            date: parsed.date,
            attendanceType: parsed.attendanceType || '',
            leaveQuantity: parsed.leaveQuantity || 0,
            clockIn: parsed.clockIn,
            clockOut: parsed.clockOut,
          });
        }
      }
      currentRecord = [line];
    } else if (currentRecord.length > 0 && line.includes('---------')) {
      // 記錄結束
      const parsed = parseRecord(currentRecord);
      if (parsed && parsed.employeeId) {
        records.push({
          employeeId: parsed.employeeId,
          name: parsed.name,
          date: parsed.date,
          attendanceType: parsed.attendanceType || '',
          leaveQuantity: parsed.leaveQuantity || 0,
          clockIn: parsed.clockIn,
          clockOut: parsed.clockOut,
        });
      }
      currentRecord = [];
    } else if (currentRecord.length > 0) {
      // 繼續收集同一記錄的行
      currentRecord.push(line);
    }
  }

  // 處理最後一筆記錄
  if (currentRecord.length > 0) {
    const parsed = parseRecord(currentRecord);
    if (parsed && parsed.employeeId) {
      records.push({
        employeeId: parsed.employeeId,
        name: parsed.name,
        date: parsed.date,
        attendanceType: parsed.attendanceType || '',
        leaveQuantity: parsed.leaveQuantity || 0,
        clockIn: parsed.clockIn,
        clockOut: parsed.clockOut,
      });
    }
  }

  // 格式驗證：檢查是否找到標題行
  if (!hasHeaderRow) {
    throw new Error('TXT 檔案格式錯誤：找不到必要的標題行（員工姓名、歸屬日期）。請確認這是正確的出勤刷卡記錄檔案。');
  }

  // 格式驗證：檢查是否至少有一筆記錄
  if (records.length === 0) {
    throw new Error('TXT 檔案中沒有找到有效的出勤記錄。請確認檔案內容是否正確。');
  }

  return records;
}

/**
 * 從 File 物件讀取並解析 TXT 內容
 * @param file - File 物件
 * @returns Promise<AttendanceRecord[]>
 */
export function parseTxtFile(file: File): Promise<AttendanceRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const records = parseTxtContent(content);
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('讀取 TXT 檔案失敗'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

