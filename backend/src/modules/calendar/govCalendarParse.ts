/**
 * 解析人事總處辦公日曆 CSV（西元日期,星期,是否放假,備註）。
 * 是否放假：0=上班、2=放假。週末且上班 → make_up。
 */

import type { GovDayType } from '@prisma/client';

export type ParsedGovDay = {
  /** YYYY-MM-DD */
  date: string;
  dayType: GovDayType;
  name: string | null;
};

function yyyymmddToIso(raw: string): string | null {
  const digits = raw.trim().replace(/-/g, '');
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * 將一列 CSV 對應為需寫入的 gov 日（一般平日不寫入）。
 */
export function mapGovCsvRow(row: {
  dateRaw: string;
  weekday: string;
  isHoliday: string;
  note: string;
}): ParsedGovDay | null {
  const date = yyyymmddToIso(row.dateRaw);
  if (!date) return null;

  const flag = row.isHoliday.trim();
  const note = row.note.trim() || null;
  const weekday = row.weekday.trim();
  const isWeekend = weekday === '六' || weekday === '日';

  if (flag === '2') {
    return { date, dayType: 'holiday', name: note };
  }

  if (flag === '0' && isWeekend) {
    return { date, dayType: 'make_up', name: note ?? '補班' };
  }

  if (flag === '0' && note && /補行|補班|調整上班/.test(note)) {
    return { date, dayType: 'make_up', name: note };
  }

  return null;
}

export function parseDgpaGovCalendarCsv(content: string): ParsedGovDay[] {
  const text = content.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const header = lines[0]!;
  if (!header.includes('西元日期') || !header.includes('是否放假')) {
    throw new Error('政府日曆 CSV 標題列不符（需含西元日期、是否放假）');
  }

  const result: ParsedGovDay[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',');
    if (cols.length < 3) continue;
    const mapped = mapGovCsvRow({
      dateRaw: cols[0] ?? '',
      weekday: cols[1] ?? '',
      isHoliday: cols[2] ?? '',
      note: cols[3] ?? '',
    });
    if (mapped) result.push(mapped);
  }
  return result;
}

export type DatasetDistribution = {
  resourceDescription: string;
  resourceDownloadUrl: string;
};

/**
 * 從 data.gov.tw dataset/14718 的 distribution 挑出指定西元年的一般 CSV（非 Google）。
 * 同名多檔時偏好含「更新」的較新檔。
 */
export function pickYearCsvUrl(
  distributions: DatasetDistribution[],
  westernYear: number,
): string | null {
  const rocYear = westernYear - 1911;
  const candidates = distributions.filter((d) => {
    const desc = d.resourceDescription;
    if (/Google/i.test(desc)) return false;
    return (
      desc.includes(`${westernYear}年`) ||
      desc.includes(`${rocYear}年`) ||
      desc.startsWith(`${rocYear}年`)
    );
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const score = (s: string) => (/更新/.test(s) ? 2 : 0) + (/utf8/i.test(s) ? 1 : 0);
    return score(b.resourceDescription) - score(a.resourceDescription);
  });
  return candidates[0]?.resourceDownloadUrl ?? null;
}
