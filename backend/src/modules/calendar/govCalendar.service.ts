import { AppError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  parseDgpaGovCalendarCsv,
  pickYearCsvUrl,
  type DatasetDistribution,
} from './govCalendarParse.js';
import { isoDateToUtcDate } from '../attendance/dateUtils.js';

const DATASET_API = 'https://data.gov.tw/api/v2/rest/dataset/14718';
const SOURCE_LABEL = 'data.gov.tw/dataset/14718';

export type GovCalendarSyncResult = {
  upsertedCount: number;
  years: number[];
  source: string;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'attendance-overtime-backend/0.1' },
  });
  if (!response.ok) {
    throw new AppError(
      502,
      'VALIDATION_ERROR',
      `無法下載政府日曆：HTTP ${response.status}`,
      { url },
    );
  }
  return response.text();
}

async function loadDistributions(): Promise<DatasetDistribution[]> {
  const response = await fetch(DATASET_API, {
    headers: { 'User-Agent': 'attendance-overtime-backend/0.1' },
  });
  if (!response.ok) {
    throw new AppError(
      502,
      'VALIDATION_ERROR',
      `無法讀取資料集 14718：HTTP ${response.status}`,
    );
  }
  const body = (await response.json()) as {
    success?: boolean;
    result?: { distribution?: DatasetDistribution[] };
  };
  const list = body.result?.distribution;
  if (!body.success || !Array.isArray(list) || list.length === 0) {
    throw new AppError(502, 'VALIDATION_ERROR', '資料集 14718 無可用資源');
  }
  return list;
}

async function syncOneYear(westernYear: number): Promise<number> {
  const distributions = await loadDistributions();
  const url = pickYearCsvUrl(distributions, westernYear);
  if (!url) {
    throw new AppError(
      502,
      'VALIDATION_ERROR',
      `資料集中找不到 ${westernYear} 年辦公日曆 CSV`,
    );
  }

  const csv = await fetchText(url);
  const days = parseDgpaGovCalendarCsv(csv);
  if (days.length === 0) {
    throw new AppError(502, 'VALIDATION_ERROR', `${westernYear} 年日曆解析後無資料`);
  }

  const syncedAt = new Date();
  let upserted = 0;
  for (const day of days) {
    await prisma.govCalendarDay.upsert({
      where: { date: isoDateToUtcDate(day.date) },
      create: {
        date: isoDateToUtcDate(day.date),
        dayType: day.dayType,
        name: day.name,
        syncedAt,
      },
      update: {
        dayType: day.dayType,
        name: day.name,
        syncedAt,
      },
    });
    upserted += 1;
  }
  return upserted;
}

/**
 * 同步指定西元年；省略則當前年＋次年。
 * 上游失敗拋 502；不阻斷加班主流程（呼叫端 catch）。
 */
export async function syncGovCalendar(
  actor: AuthUser | null,
  year?: number,
): Promise<GovCalendarSyncResult> {
  const nowYear = new Date().getUTCFullYear();
  const years = year != null ? [year] : [nowYear, nowYear + 1];

  let upsertedCount = 0;
  const errors: string[] = [];
  for (const y of years) {
    try {
      upsertedCount += await syncOneYear(y);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${y}: ${msg}`);
    }
  }

  if (upsertedCount === 0) {
    throw new AppError(
      502,
      'VALIDATION_ERROR',
      `政府日曆同步失敗：${errors.join('；') || '未知錯誤'}`,
    );
  }

  await writeAudit(
    prisma,
    'gov_calendar_sync',
    { years, upsertedCount, errors, source: SOURCE_LABEL },
    actor?.id ?? null,
  );

  return {
    upsertedCount,
    years,
    source: SOURCE_LABEL,
  };
}

/** 背景同步：失敗只記 log，不丟出 */
export async function syncGovCalendarQuiet(
  log: { warn: (obj: unknown, msg?: string) => void },
): Promise<void> {
  try {
    await syncGovCalendar(null);
  } catch (err) {
    log.warn({ err }, '政府日曆背景同步失敗（可手勾補班）');
  }
}
