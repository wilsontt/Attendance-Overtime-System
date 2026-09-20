import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  deriveDayType,
  eachDateInclusive,
  type ApiDayType,
} from '../computation/computation.service.js';
import {
  formatIsoDateOnly,
} from '../shift/shift.rules.js';

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

export async function getLeaveCalendar(
  actor: AuthUser,
  query: { employeeId?: string; year: number; month?: number },
): Promise<LeaveCalendarResponse> {
  if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'year 無效');
  }
  if (
    query.month != null &&
    (!Number.isInteger(query.month) || query.month < 1 || query.month > 12)
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'month 須為 1–12');
  }

  const targetEmployeeId =
    actor.role === 'admin' && query.employeeId
      ? query.employeeId
      : actor.employeeId;

  if (
    actor.role !== 'admin' &&
    query.employeeId &&
    query.employeeId !== actor.employeeId
  ) {
    throw new AppError(403, 'FORBIDDEN', '僅能查看本人行事曆');
  }

  const user = await prisma.user.findUnique({
    where: { employeeId: targetEmployeeId },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', '找不到員工');
  }

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
        userId: user.id,
        belongDate: { gte: dateFrom, lte: dateTo },
      },
    }),
  ]);

  const govMap = new Map(
    govDays.map((d) => [formatIsoDateOnly(d.date), d]),
  );
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
    employeeId: targetEmployeeId,
    year: query.year,
    month: query.month ?? null,
    days,
  };
}
