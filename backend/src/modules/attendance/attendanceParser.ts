import { AppError } from '../../lib/errors.js';
import { parseBelongDateToIso } from './dateUtils.js';
import {
  isUnknownLeaveType,
  normalizeAttendanceType,
} from './leaveTypes.js';

export type ParsedAttendanceRow = {
  employeeId: string;
  name: string;
  /** ISO YYYY-MM-DD */
  belongDate: string;
  attendanceType: string | null;
  leaveQuantity: number;
  clockIn: string | null;
  clockOut: string | null;
  unknownLeaveType: boolean;
};

function normalizeTime(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d{2}:\d{2}$/.test(t)) {
    throw new AppError(400, 'VALIDATION_ERROR', `時間格式錯誤：${raw}`);
  }
  return t;
}

function toRow(input: {
  employeeId: string;
  name: string;
  dateRaw: string;
  attendanceTypeRaw: string;
  leaveQuantity: number;
  clockIn: string;
  clockOut: string;
}): ParsedAttendanceRow {
  if (!/^\d{6}$/.test(input.employeeId)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `員工編號須為 6 碼：${input.employeeId}`,
    );
  }
  const attendanceType = normalizeAttendanceType(input.attendanceTypeRaw);
  return {
    employeeId: input.employeeId,
    name: input.name.trim(),
    belongDate: parseBelongDateToIso(input.dateRaw),
    attendanceType,
    leaveQuantity: Number.isFinite(input.leaveQuantity)
      ? input.leaveQuantity
      : 0,
    clockIn: normalizeTime(input.clockIn),
    clockOut: normalizeTime(input.clockOut),
    unknownLeaveType: isUnknownLeaveType(attendanceType),
  };
}

/**
 * CSV：員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間
 */
export function parseCsvAttendance(content: string): ParsedAttendanceRow[] {
  const text = content.replace(/^\uFEFF/, '').trim();
  if (!text) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CSV 檔案內容為空');
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CSV 沒有資料列');
  }

  const header = lines[0]!;
  if (!header.includes('員工編號') || !header.includes('歸屬日期')) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'CSV 標題列須含「員工編號」「歸屬日期」',
    );
  }

  const rows: ParsedAttendanceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 7) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `CSV 第 ${i + 1} 列欄位不足`,
      );
    }
    rows.push(
      toRow({
        employeeId: cols[0]!,
        name: cols[1]!,
        dateRaw: cols[2]!,
        attendanceTypeRaw: cols[3]!,
        leaveQuantity: parseFloat(cols[4]!) || 0,
        clockIn: cols[5]!,
        clockOut: cols[6]!,
      }),
    );
  }

  if (rows.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CSV 沒有有效出勤列');
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

type TxtParsed = {
  employeeId: string;
  name: string;
  date: string;
  attendanceType: string;
  leaveQuantity: number;
  clockIn: string;
  clockOut: string;
};

function parseTxtRecordBlock(lines: string[]): TxtParsed | null {
  if (lines.length === 0) return null;

  const result: TxtParsed = {
    employeeId: '',
    name: '',
    date: '',
    attendanceType: '',
    leaveQuantity: 0,
    clockIn: '',
    clockOut: '',
  };

  const firstLine = lines[0];
  if (!firstLine) return null;

  const nameMatch = firstLine.match(/(\d{6})\s+([\u4e00-\u9fa5]+)/);
  if (nameMatch) {
    result.employeeId = nameMatch[1] ?? '';
    result.name = nameMatch[2] ?? '';
  }

  const dateMatch = firstLine.match(/(\d{7})(?:\/\d)?/);
  if (dateMatch) {
    result.date = dateMatch[1] ?? '';
  }

  const leaveMatch = firstLine.match(
    /(請年休假|病假|婚假|產假|育嬰假|事假|公假|喪假)\/(\d+(?:\.\d+)?)日/,
  );
  if (leaveMatch) {
    result.attendanceType = leaveMatch[1] ?? '';
    result.leaveQuantity = parseFloat(leaveMatch[2] ?? '0');
  } else {
    const unknownLeave = firstLine.match(
      /([\u4e00-\u9fa5]{1,10})\/(\d+(?:\.\d+)?)日/,
    );
    const unknownName = unknownLeave?.[1];
    if (
      unknownName &&
      !['上班', '下班'].includes(unknownName)
    ) {
      result.attendanceType = unknownName;
      result.leaveQuantity = parseFloat(unknownLeave?.[2] ?? '0');
    }
  }

  let clockIn = '';
  let clockOut = '';
  const fallbackTimes: string[] = [];

  for (const line of lines) {
    const timeMatch = line.match(/\d{7}\s+(\d{2}:\d{2})\s+(?:正常|異常|符合)/);
    const punchTime = timeMatch?.[1];
    if (punchTime) {
      if (line.includes('上班/')) {
        clockIn = punchTime;
      } else if (line.includes('下班/')) {
        clockOut = punchTime;
      } else {
        fallbackTimes.push(punchTime);
      }
    }
  }

  if (fallbackTimes.length > 0) {
    if (fallbackTimes.length === 1 && !clockIn && !clockOut) {
      const firstFallback = fallbackTimes[0] ?? '';
      const hour = Number.parseInt(firstFallback.split(':')[0] ?? '0', 10);
      if (hour >= 12) {
        clockOut = fallbackTimes.shift() ?? '';
      } else {
        clockIn = fallbackTimes.shift() ?? '';
      }
    } else {
      if (!clockIn && fallbackTimes.length > 0) {
        clockIn = fallbackTimes.shift() || '';
      }
      if (!clockOut && fallbackTimes.length > 0) {
        clockOut = fallbackTimes.shift() || '';
      }
    }
  }

  result.clockIn = clockIn;
  result.clockOut = clockOut;
  return result;
}

/**
 * TXT：固定寬度出勤刷卡記錄（對齊前端 txtParser）。
 */
export function parseTxtAttendance(content: string): ParsedAttendanceRow[] {
  if (!content || content.trim() === '') {
    throw new AppError(400, 'VALIDATION_ERROR', 'TXT 檔案內容為空');
  }

  const lines = content.split(/\r?\n/);
  const records: TxtParsed[] = [];
  let currentRecord: string[] = [];
  let isDataSection = false;
  let hasHeaderRow = false;

  const flush = () => {
    if (currentRecord.length === 0) return;
    const parsed = parseTxtRecordBlock(currentRecord);
    if (parsed?.employeeId) records.push(parsed);
    currentRecord = [];
  };

  for (const line of lines) {
    if (line.includes('員工姓名') && line.includes('歸屬日期')) {
      isDataSection = true;
      hasHeaderRow = true;
      continue;
    }

    if (
      line.includes('====') ||
      line.includes('... 接下頁 ...') ||
      line.trim() === ''
    ) {
      flush();
      continue;
    }

    if (isDataSection && /\d{6}\s+[\u4e00-\u9fa5]+/.test(line)) {
      flush();
      currentRecord = [line];
    } else if (currentRecord.length > 0 && line.includes('---------')) {
      flush();
    } else if (currentRecord.length > 0) {
      currentRecord.push(line);
    }
  }
  flush();

  if (!hasHeaderRow) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'TXT 找不到標題行（員工姓名、歸屬日期）',
    );
  }
  if (records.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'TXT 沒有有效出勤記錄');
  }

  return records.map((r) =>
    toRow({
      employeeId: r.employeeId,
      name: r.name,
      dateRaw: r.date,
      attendanceTypeRaw: r.attendanceType,
      leaveQuantity: r.leaveQuantity,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
    }),
  );
}

export function parseAttendanceFile(
  filename: string,
  content: string,
): ParsedAttendanceRow[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return parseCsvAttendance(content);
  }
  if (lower.endsWith('.txt')) {
    return parseTxtAttendance(content);
  }
  // 無副檔名時依內容推斷
  if (content.includes('員工姓名') && content.includes('歸屬日期')) {
    return parseTxtAttendance(content);
  }
  return parseCsvAttendance(content);
}
