import type { ShiftStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';
import {
  assertTimeHm,
  canDeleteShift,
  canDisableShift,
  formatIsoDateOnly,
  isActiveAssignment,
  parseIsoDateOnly,
  toShiftDto,
} from './shift.rules.js';

export type ShiftWriteBody = {
  name: string;
  startTime: string;
  endTime: string;
};

export type ShiftUpdateBody = {
  name?: string;
  startTime?: string;
  endTime?: string;
  status?: ShiftStatus;
};

export type AssignmentWriteBody = {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

function wrapValidation(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      error instanceof Error ? error.message : '驗證失敗',
    );
  }
}

export async function listShifts(includeDisabled = true) {
  const items = await prisma.shift.findMany({
    where: includeDisabled ? undefined : { status: 'active' },
    orderBy: { name: 'asc' },
  });
  return { items: items.map(toShiftDto) };
}

export async function createShift(actor: AuthUser, body: ShiftWriteBody) {
  wrapValidation(() => {
    if (!body.name?.trim()) throw new Error('班名不可空白');
    assertTimeHm(body.startTime, 'startTime');
    assertTimeHm(body.endTime, 'endTime');
  });

  try {
    const shift = await prisma.shift.create({
      data: {
        name: body.name.trim(),
        startTime: body.startTime,
        endTime: body.endTime,
        status: 'active',
      },
    });
    await writeAudit(prisma, 'shift_create', { shiftId: shift.id }, actor.id);
    return toShiftDto(shift);
  } catch {
    throw new AppError(409, 'CONFLICT', '班名已存在');
  }
}

export async function updateShift(
  actor: AuthUser,
  shiftId: string,
  body: ShiftUpdateBody,
) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AppError(404, 'NOT_FOUND', '找不到班表');

  if (body.startTime) wrapValidation(() => assertTimeHm(body.startTime!, 'startTime'));
  if (body.endTime) wrapValidation(() => assertTimeHm(body.endTime!, 'endTime'));
  if (body.name !== undefined && !body.name.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', '班名不可空白');
  }

  if (body.status === 'disabled') {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { shiftId },
      select: { effectiveTo: true },
    });
    const today = new Date();
    const hasActive = assignments.some((a) =>
      isActiveAssignment(a.effectiveTo, today),
    );
    const gate = canDisableShift({ hasActiveAssignment: hasActive });
    if (!gate.ok) {
      throw new AppError(
        409,
        gate.code,
        '目前仍有員工派在此班，無法停用',
      );
    }
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
      ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });

  await writeAudit(
    prisma,
    'shift_update',
    { shiftId, fields: Object.keys(body) },
    actor.id,
  );
  return toShiftDto(updated);
}

export async function deleteShift(actor: AuthUser, shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AppError(404, 'NOT_FOUND', '找不到班表');

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { shiftId },
  });
  const gate = canDeleteShift({ assignmentCount });
  if (!gate.ok) {
    throw new AppError(409, gate.code, '班表已有引用，不可刪除，僅可停用');
  }

  await prisma.shift.delete({ where: { id: shiftId } });
  await writeAudit(prisma, 'shift_delete', { shiftId }, actor.id);
}

function toAssignmentDto(row: {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  user: { employeeId: string };
  shift: { id: string; name: string };
}) {
  return {
    id: row.id,
    employeeId: row.user.employeeId,
    shiftId: row.shift.id,
    shiftName: row.shift.name,
    effectiveFrom: formatIsoDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatIsoDateOnly(row.effectiveTo) : null,
  };
}

export async function listShiftAssignments(employeeId?: string) {
  const items = await prisma.shiftAssignment.findMany({
    where: employeeId
      ? { user: { employeeId } }
      : undefined,
    include: { user: true, shift: true },
    orderBy: [{ effectiveFrom: 'desc' }],
  });
  return { items: items.map(toAssignmentDto) };
}

export async function createShiftAssignment(
  actor: AuthUser,
  body: AssignmentWriteBody,
) {
  if (!/^\d{6}$/.test(body.employeeId)) {
    throw new AppError(400, 'VALIDATION_ERROR', '員工編號須為 6 位數字');
  }
  let effectiveFrom: Date;
  let effectiveTo: Date | null = null;
  wrapValidation(() => {
    effectiveFrom = parseIsoDateOnly(body.effectiveFrom, 'effectiveFrom');
    if (body.effectiveTo) {
      effectiveTo = parseIsoDateOnly(body.effectiveTo, 'effectiveTo');
    }
  });

  const user = await prisma.user.findUnique({
    where: { employeeId: body.employeeId },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', '找不到員工');

  const shift = await prisma.shift.findUnique({ where: { id: body.shiftId } });
  if (!shift) throw new AppError(404, 'NOT_FOUND', '找不到班表');
  if (shift.status !== 'active') {
    throw new AppError(400, 'VALIDATION_ERROR', '停用班表不可指派');
  }

  const created = await prisma.shiftAssignment.create({
    data: {
      userId: user.id,
      shiftId: shift.id,
      effectiveFrom: effectiveFrom!,
      effectiveTo,
    },
    include: { user: true, shift: true },
  });

  await writeAudit(
    prisma,
    'shift_assignment_create',
    { id: created.id, employeeId: body.employeeId },
    actor.id,
  );
  return toAssignmentDto(created);
}

export async function updateShiftAssignment(
  actor: AuthUser,
  assignmentId: string,
  body: AssignmentWriteBody,
) {
  const existing = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', '找不到派班');

  if (!/^\d{6}$/.test(body.employeeId)) {
    throw new AppError(400, 'VALIDATION_ERROR', '員工編號須為 6 位數字');
  }
  let effectiveFrom: Date;
  let effectiveTo: Date | null = null;
  wrapValidation(() => {
    effectiveFrom = parseIsoDateOnly(body.effectiveFrom, 'effectiveFrom');
    if (body.effectiveTo) {
      effectiveTo = parseIsoDateOnly(body.effectiveTo, 'effectiveTo');
    }
  });

  const user = await prisma.user.findUnique({
    where: { employeeId: body.employeeId },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', '找不到員工');

  const shift = await prisma.shift.findUnique({ where: { id: body.shiftId } });
  if (!shift) throw new AppError(404, 'NOT_FOUND', '找不到班表');
  if (shift.status !== 'active') {
    throw new AppError(400, 'VALIDATION_ERROR', '停用班表不可指派');
  }

  const updated = await prisma.shiftAssignment.update({
    where: { id: assignmentId },
    data: {
      userId: user.id,
      shiftId: shift.id,
      effectiveFrom: effectiveFrom!,
      effectiveTo,
    },
    include: { user: true, shift: true },
  });

  await writeAudit(
    prisma,
    'shift_assignment_update',
    { id: assignmentId },
    actor.id,
  );
  return toAssignmentDto(updated);
}

export async function deleteShiftAssignment(
  actor: AuthUser,
  assignmentId: string,
) {
  const existing = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', '找不到派班');

  await prisma.shiftAssignment.delete({ where: { id: assignmentId } });
  await writeAudit(
    prisma,
    'shift_assignment_delete',
    { id: assignmentId },
    actor.id,
  );
}
