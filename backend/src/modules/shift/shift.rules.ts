import type { Shift, ShiftStatus } from '@prisma/client';

const TIME_HM = /^\d{2}:\d{2}$/;

export function assertTimeHm(value: string, field: string): void {
  if (!TIME_HM.test(value)) {
    throw new Error(`${field} 須為 HH:mm`);
  }
}

/** 是否為「現職」派班：迄日為 null 或迄日 >= today（date-only UTC） */
export function isActiveAssignment(
  effectiveTo: Date | null,
  today: Date,
): boolean {
  if (effectiveTo === null) return true;
  const to = Date.UTC(
    effectiveTo.getUTCFullYear(),
    effectiveTo.getUTCMonth(),
    effectiveTo.getUTCDate(),
  );
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return to >= t;
}

export function canDisableShift(params: {
  hasActiveAssignment: boolean;
}): { ok: true } | { ok: false; code: 'SHIFT_HAS_ACTIVE_ASSIGNMENT' } {
  if (params.hasActiveAssignment) {
    return { ok: false, code: 'SHIFT_HAS_ACTIVE_ASSIGNMENT' };
  }
  return { ok: true };
}

export function canDeleteShift(params: {
  assignmentCount: number;
}): { ok: true } | { ok: false; code: 'SHIFT_IN_USE' } {
  if (params.assignmentCount > 0) {
    return { ok: false, code: 'SHIFT_IN_USE' };
  }
  return { ok: true };
}

export function toShiftDto(shift: Shift) {
  return {
    id: shift.id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    status: shift.status as ShiftStatus,
  };
}

export function parseIsoDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} 須為 YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} 日期無效`);
  }
  return date;
}

export function formatIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
