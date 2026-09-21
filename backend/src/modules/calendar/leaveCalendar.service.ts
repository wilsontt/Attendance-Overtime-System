import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  deriveDayType,
  eachDateInclusive,
  type ApiDayType,
} from '../computation/computation.service.js';
import { formatIsoDateOnly } from '../shift/shift.rules.js';
import {
  summarizeLeaveQuantities,
  type LeaveSummaryTotals,
} from './leaveSummary.js';

export type LeaveCalendarDayDto = {
  date: string;
  dayType: ApiDayType;
  leaveType: string | null;
  leaveQuantity: number | null;
  govName?: string | null;
};

export type LeaveCalendarResponse = {
  employeeId: string;
  year: number;
  month: number | null;
  days: LeaveCalendarDayDto[];
};

export type LeaveSummaryResponse = LeaveSummaryTotals & {
  employeeId: string;
  year: number;
};

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'year 無效');
  }
}

async function resolveCalendarSubject(
  actor: AuthUser,
  employeeId: string | undefined,
): Promise<{ employeeId: string; userId: string }> {
  const targetEmployeeId =
    actor.role === 'admin' && employeeId ? employeeId : actor.employeeId;

  if (actor.role !== 'admin' && employeeId && employeeId !== actor.employeeId) {
    throw new AppError(403, 'FORBIDDEN', '僅能查看本人假勤');
  }

  const user = await prisma.user.findUnique({
    where: { employeeId: targetEmployeeId },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', '找不到員工');
  }

  return { employeeId: targetEmployeeId, userId: user.id };
}

export async function getLeaveCalendar(
  actor: AuthUser,
  query: { employeeId?: string; year: number; month?: number },
): Promise<LeaveCalendarResponse> {
  assertYear(query.year);
  if (
    query.month != null &&
    (!Number.isInteger(query.month) || query.month < 1 || query.month > 12)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'month 須為 1–12');
  }

  const subject = await resolveCalendarSubject(actor, query.employeeId);

  const dateFrom =
    query.month != null
      ? new Date(Date.UTC(query.year, query.month - 1, 1))
      : new Date(Date.UTC(query.year, 0, 1));
  const dateTo =
    query.month != null
      ? new Date(Date.UTC(query.year, query.month, 0))
      : new Date(Date.UTC(query.year, 11, 31));

  const [govDays, attendance] = await Promise.all([
    prisma.govCalendarDay.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.attendanceDay.findMany({
      where: {
        userId: subject.userId,
        belongDate: { gte: dateFrom, lte: dateTo },
      },
    }),
  ]);

  const govMap = new Map(govDays.map((d) => [formatIsoDateOnly(d.date), d]));
  const leaveMap = new Map(
    attendance.map((d) => [formatIsoDateOnly(d.belongDate), d]),
  );

  const days = eachDateInclusive(dateFrom, dateTo).map((date) => {
    const key = formatIsoDateOnly(date);
    const gov = govMap.get(key);
    const leave = leaveMap.get(key);
    const hasLeave =
      Boolean(leave?.attendanceType) || Number(leave?.leaveQuantity ?? 0) > 0;

    return {
      date: key,
      dayType: deriveDayType(date, gov?.dayType ?? null),
      leaveType: hasLeave ? (leave?.attendanceType ?? null) : null,
      leaveQuantity: hasLeave ? Number(leave?.leaveQuantity ?? 0) : null,
      govName: gov?.name ?? null,
    };
  });

  return {
    employeeId: subject.employeeId,
    year: query.year,
    month: query.month ?? null,
    days,
  };
}

/** 選定曆年的假勤摘要：年假額度／已請／剩餘＋各非年假假別已請（含 0）。 */
export async function getLeaveSummary(
  actor: AuthUser,
  query: { employeeId?: string; year: number },
): Promise<LeaveSummaryResponse> {
  assertYear(query.year);
  const subject = await resolveCalendarSubject(actor, query.employeeId);

  const dateFrom = new Date(Date.UTC(query.year, 0, 1));
  const dateTo = new Date(Date.UTC(query.year, 11, 31));

  const [quota, rows] = await Promise.all([
    prisma.annualLeaveQuota.findUnique({
      where: {
        userId_year: { userId: subject.userId, year: query.year },
      },
    }),
    prisma.attendanceDay.findMany({
      where: {
        userId: subject.userId,
        belongDate: { gte: dateFrom, lte: dateTo },
      },
      select: {
        attendanceType: true,
        leaveQuantity: true,
        unknownLeaveType: true,
      },
    }),
  ]);

  const totals = summarizeLeaveQuantities(
    rows.map((row) => ({
      attendanceType: row.attendanceType,
      leaveQuantity: Number(row.leaveQuantity),
      unknownLeaveType: row.unknownLeaveType,
    })),
    quota ? Number(quota.quotaDays) : 0,
  );

  return {
    employeeId: subject.employeeId,
    year: query.year,
    ...totals,
  };
}
