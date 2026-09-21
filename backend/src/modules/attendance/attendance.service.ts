import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  parseAttendanceFile,
  type ParsedAttendanceRow,
} from './attendanceParser.js';
import {
  calendarYearOfIso,
  isoDateToUtcDate,
  utcDateToIso,
} from './dateUtils.js';
import { ANNUAL_LEAVE_TYPE } from './leaveTypes.js';

export type AttendanceImportResult = {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  importedCount: number;
  unknownLeaveTypes: string[];
  quotaAfter: Array<{
    year: number;
    quotaDays: number;
    usedDays: number;
    remainingDays: number;
  }>;
};

export type AttendanceDayDto = {
  employeeId: string;
  name: string;
  belongDate: string;
  attendanceType: string | null;
  leaveQuantity: number;
  clockIn: string | null;
  clockOut: string | null;
  unknownLeaveType: boolean;
};

async function usedLeaveDays(
  tx: Prisma.TransactionClient,
  userId: string,
  year: number,
): Promise<number> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const rows = await tx.attendanceDay.findMany({
    where: {
      userId,
      attendanceType: ANNUAL_LEAVE_TYPE,
      belongDate: { gte: start, lte: end },
    },
    select: { leaveQuantity: true },
  });
  return rows.reduce((sum, row) => sum + Number(row.leaveQuantity), 0);
}

async function quotaSnapshots(
  tx: Prisma.TransactionClient,
  userId: string,
  years: number[],
) {
  const uniqueYears = [...new Set(years)].sort();
  const result: AttendanceImportResult['quotaAfter'] = [];
  for (const year of uniqueYears) {
    const quota = await tx.annualLeaveQuota.findUnique({
      where: { userId_year: { userId, year } },
    });
    const usedDays = await usedLeaveDays(tx, userId, year);
    const quotaDays = quota ? Number(quota.quotaDays) : 0;
    result.push({
      year,
      quotaDays,
      usedDays,
      remainingDays: quotaDays - usedDays,
    });
  }
  return result;
}

function assertSingleEmployee(rows: ParsedAttendanceRow[]): string {
  if (rows.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', '沒有可匯入的出勤列');
  }
  const firstId = rows[0]!.employeeId;
  const ids = new Set(rows.map((r) => r.employeeId));
  if (ids.size !== 1) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      '單次正式匯入僅支援同一員工編號（一人一檔）',
    );
  }
  return firstId;
}

/**
 * 伺服器正式匯入：區間刪除後整段寫入；請年休假加總自然回沖（見 data-model §5）。
 */
export async function importAttendanceFile(
  actor: AuthUser,
  filename: string,
  content: string,
): Promise<AttendanceImportResult> {
  const rows = parseAttendanceFile(filename, content);
  const fileEmployeeId = assertSingleEmployee(rows);

  if (actor.role === 'employee' && actor.employeeId !== fileEmployeeId) {
    throw new AppError(403, 'IMPORT_NOT_SELF', '僅能匯入本人出勤檔');
  }

  const owner = await prisma.user.findUnique({
    where: { employeeId: fileEmployeeId },
  });
  if (!owner || !owner.isActive) {
    throw new AppError(404, 'NOT_FOUND', `找不到員工 ${fileEmployeeId}`);
  }

  const dates = rows.map((r) => r.belongDate).sort();
  const dateFrom = dates[0]!;
  const dateTo = dates[dates.length - 1]!;
  const dateFromUtc = isoDateToUtcDate(dateFrom);
  const dateToUtc = isoDateToUtcDate(dateTo);

  // 同日多列：後列覆蓋前列（完整檔應一日一列）
  const byDate = new Map<string, ParsedAttendanceRow>();
  for (const row of rows) {
    byDate.set(row.belongDate, row);
  }
  const uniqueRows = [...byDate.values()];

  const unknownLeaveTypes = [
    ...new Set(
      uniqueRows
        .filter((r) => r.unknownLeaveType && r.attendanceType)
        .map((r) => r.attendanceType as string),
    ),
  ];

  const affectedYears = uniqueRows.map((r) => calendarYearOfIso(r.belongDate));
  // 重匯也會影響區間內舊列所屬年 → 一併納入快照
  affectedYears.push(calendarYearOfIso(dateFrom), calendarYearOfIso(dateTo));

  const result = await prisma.$transaction(async (tx) => {
    // SQLite 無 FOR UPDATE；以交易串行化重匯刪增即可
    await tx.attendanceDay.deleteMany({
      where: {
        userId: owner.id,
        belongDate: { gte: dateFromUtc, lte: dateToUtc },
      },
    });

    const batch = await tx.attendanceImportBatch.create({
      data: {
        userId: owner.id,
        importedById: actor.id,
        dateFrom: dateFromUtc,
        dateTo: dateToUtc,
        sourceFilename: filename,
      },
    });

    await tx.attendanceDay.createMany({
      data: uniqueRows.map((row) => ({
        userId: owner.id,
        belongDate: isoDateToUtcDate(row.belongDate),
        attendanceType: row.attendanceType,
        leaveQuantity: new Prisma.Decimal(row.leaveQuantity),
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        unknownLeaveType: row.unknownLeaveType,
        importBatchId: batch.id,
      })),
    });

    await writeAudit(
      tx,
      'import',
      {
        employeeId: fileEmployeeId,
        dateFrom,
        dateTo,
        importedCount: uniqueRows.length,
        unknownLeaveTypes,
        filename,
      },
      actor.id,
    );

    const quotaAfter = await quotaSnapshots(tx, owner.id, affectedYears);

    return {
      employeeId: fileEmployeeId,
      dateFrom,
      dateTo,
      importedCount: uniqueRows.length,
      unknownLeaveTypes,
      quotaAfter,
    } satisfies AttendanceImportResult;
  });

  return result;
}

export async function listAttendance(
  actor: AuthUser,
  query: { employeeId?: string; dateFrom?: string; dateTo?: string },
): Promise<{ items: AttendanceDayDto[] }> {
  let targetEmployeeId = actor.employeeId;
  if (actor.role === 'admin' && query.employeeId) {
    targetEmployeeId = query.employeeId;
  } else if (
    actor.role === 'employee' &&
    query.employeeId &&
    query.employeeId !== actor.employeeId
  ) {
    throw new AppError(403, 'FORBIDDEN', '僅能查詢本人出勤');
  }

  const user = await prisma.user.findUnique({
    where: { employeeId: targetEmployeeId },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', '找不到員工');
  }

  const where: Prisma.AttendanceDayWhereInput = { userId: user.id };
  if (query.dateFrom || query.dateTo) {
    where.belongDate = {};
    if (query.dateFrom) {
      where.belongDate.gte = isoDateToUtcDate(query.dateFrom);
    }
    if (query.dateTo) {
      where.belongDate.lte = isoDateToUtcDate(query.dateTo);
    }
  }

  const days = await prisma.attendanceDay.findMany({
    where,
    orderBy: { belongDate: 'asc' },
  });

  return {
    items: days.map((d) => ({
      employeeId: user.employeeId,
      name: user.name,
      belongDate: utcDateToIso(d.belongDate),
      attendanceType: d.attendanceType,
      leaveQuantity: Number(d.leaveQuantity),
      clockIn: d.clockIn,
      clockOut: d.clockOut,
      unknownLeaveType: d.unknownLeaveType,
    })),
  };
}
