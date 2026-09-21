import { AppError } from '../../lib/errors.js';

/** 將 YYYY-MM-DD 轉為 UTC 日界 Date（Prisma @db.Date） */
export function isoDateToUtcDate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new AppError(400, 'VALIDATION_ERROR', `日期格式錯誤：${iso}`);
  }
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcDateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 民國 7 碼（例 1141001）或西元 YYYY-MM-DD／YYYY/MM/DD → ISO 日期。
 */
export function parseBelongDateToIso(raw: string): string {
  const value = raw.trim();
  if (/^\d{7}$/.test(value)) {
    const rocYear = Number(value.slice(0, 3));
    const month = Number(value.slice(3, 5));
    const day = Number(value.slice(5, 7));
    const year = rocYear + 1911;
    const probe = new Date(year, month - 1, day);
    if (
      probe.getFullYear() !== year ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', `無效歸屬日期：${raw}`);
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const normalized = value.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    isoDateToUtcDate(normalized);
    return normalized;
  }

  throw new AppError(400, 'VALIDATION_ERROR', `無法解析歸屬日期：${raw}`);
}

export function calendarYearOfIso(iso: string): number {
  return Number(iso.slice(0, 4));
}
