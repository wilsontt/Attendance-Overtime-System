import type { GovDayType, Shift } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  formatIsoDateOnly,
  parseIsoDateOnly,
  toShiftDto,
} from '../shift/shift.rules.js';

export type ApiDayType = 'weekday' | 'rest_day' | 'holiday' | 'make_up';

/**
 * 依 research.md：gov 補班 → make_up；gov 放假 → holiday；
 * 否則週一～五 weekday、週六 rest_day、週日 holiday。
 */
export function deriveDayType(
  date: Date,
  govType: GovDayType | null,
): ApiDayType {
  if (govType === 'make_up') return 'make_up';
  if (govType === 'holiday') return 'holiday';
  const dow = date.getUTCDay(); // 0=Sun
  if (dow === 0) return 'holiday';
  if (dow === 6) return 'rest_day';
  return 'weekday';
}

export function eachDateInclusive(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function pickAssignmentForDate<
  T extends { effectiveFrom: Date; effectiveTo: Date | null },
>(assignments: T[], date: Date): T | null {
  const t = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const matched = assignments.filter((a) => {
    const from = Date.UTC(
      a.effectiveFrom.getUTCFullYear(),
      a.effectiveFrom.getUTCMonth(),
      a.effectiveFrom.getUTCDate(),
    );
    if (from > t) return false;
    if (a.effectiveTo === null) return true;
    const to = Date.UTC(
      a.effectiveTo.getUTCFullYear(),
      a.effectiveTo.getUTCMonth(),
      a.effectiveTo.getUTCDate(),
    );
    return to >= t;
  });
  if (matched.length === 0) return null;
  matched.sort(
    (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
  );
  return matched[0] ?? null;
}

export async function getComputationContext(
  actor: AuthUser,
  query: { employeeId?: string; dateFrom: string; dateTo: string },
) {
  let dateFrom: Date;
  let dateTo: Date;
  try {
    dateFrom = parseIsoDateOnly(query.dateFrom, 'dateFrom');
    dateTo = parseIsoDateOnly(query.dateTo, 'dateTo');
  } catch (error) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      error instanceof Error ? error.message : '日期格式錯誤',
    );
  }
  if (dateFrom.getTime() > dateTo.getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'dateFrom 不可晚於 dateTo');
  }

  const targetEmployeeId =
    actor.role === 'admin' && query.employeeId
      ? query.employeeId
      : actor.employeeId;

  if (actor.role !== 'admin' && query.employeeId && query.employeeId !== actor.employeeId) {
    throw new AppError(403, 'FORBIDDEN', '權限不足');
  }

  const user = await prisma.user.findUnique({
    where: { employeeId: targetEmployeeId },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', '找不到員工');

  const assignments = await prisma.shiftAssignment.findMany({
    where: { userId: user.id },
    include: { shift: true },
    orderBy: { effectiveFrom: 'desc' },
  });

  const govDays = await prisma.govCalendarDay.findMany({
    where: {
      date: { gte: dateFrom, lte: dateTo },
    },
  });
  const govMap = new Map(
    govDays.map((d) => [formatIsoDateOnly(d.date), d.dayType]),
  );

  const days = eachDateInclusive(dateFrom, dateTo).map((date) => {
    const key = formatIsoDateOnly(date);
    const assignment = pickAssignmentForDate(assignments, date);
    const shift: Shift | null = assignment?.shift ?? null;
    return {
      date: key,
      dayType: deriveDayType(date, govMap.get(key) ?? null),
      shift: shift ? toShiftDto(shift) : null,
    };
  });

  return {
    employeeId: targetEmployeeId,
    dateFrom: formatIsoDateOnly(dateFrom),
    dateTo: formatIsoDateOnly(dateTo),
    days,
  };
}
