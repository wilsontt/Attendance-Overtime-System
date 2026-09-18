import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { writeAudit } from '../../lib/audit.js';
import { hashSecret } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/auth.service.js';

const ANNUAL_LEAVE_TYPE = '請年休假';

export type EmployeeCreateBody = {
  employeeId: string;
  name: string;
  pin: string;
  isActive?: boolean;
  quotaYear?: number;
  quotaDays?: number;
};

export type EmployeeUpdateBody = {
  name?: string;
  pin?: string;
  isActive?: boolean;
  password?: string;
  quota?: { year: number; quotaDays: number };
};

function assertEmployeeId(employeeId: string): void {
  if (!/^\d{6}$/.test(employeeId)) {
    throw new AppError(400, 'VALIDATION_ERROR', '員工編號須為 6 位數字');
  }
}

function assertPin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'PIN 須為 4 位數字');
  }
}

async function usedLeaveDays(userId: string, year: number): Promise<number> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const rows = await prisma.attendanceDay.findMany({
    where: {
      userId,
      attendanceType: ANNUAL_LEAVE_TYPE,
      belongDate: { gte: start, lte: end },
    },
    select: { leaveQuantity: true },
  });
  return rows.reduce((sum, row) => sum + Number(row.leaveQuantity), 0);
}

async function buildQuotas(userId: string) {
  const quotas = await prisma.annualLeaveQuota.findMany({
    where: { userId },
    orderBy: { year: 'desc' },
  });
  return Promise.all(
    quotas.map(async (q) => {
      const usedDays = await usedLeaveDays(userId, q.year);
      const quotaDays = Number(q.quotaDays);
      return {
        year: q.year,
        quotaDays,
        usedDays,
        remainingDays: quotaDays - usedDays,
      };
    }),
  );
}

function toEmployee(user: {
  employeeId: string;
  name: string;
  role: 'employee' | 'admin';
  isActive: boolean;
}) {
  return {
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function listEmployees(activeOnly = false) {
  const users = await prisma.user.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { employeeId: 'asc' },
  });
  return { items: users.map(toEmployee) };
}

export async function getEmployee(employeeId: string) {
  assertEmployeeId(employeeId);
  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', '找不到員工');
  }
  return {
    ...toEmployee(user),
    quotas: await buildQuotas(user.id),
  };
}

export async function createEmployee(
  actor: AuthUser,
  body: EmployeeCreateBody,
) {
  assertEmployeeId(body.employeeId);
  assertPin(body.pin);
  if (!body.name?.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', '姓名不可空白');
  }

  const existing = await prisma.user.findUnique({
    where: { employeeId: body.employeeId },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', '員工編號已存在');
  }

  const year = body.quotaYear ?? new Date().getFullYear();
  const quotaDays = body.quotaDays ?? 0;
  const pinHash = await hashSecret(body.pin);

  const user = await prisma.user.create({
    data: {
      employeeId: body.employeeId,
      name: body.name.trim(),
      role: 'employee',
      pinHash,
      isActive: body.isActive ?? true,
      quotas: {
        create: {
          year,
          quotaDays: new Prisma.Decimal(quotaDays),
        },
      },
    },
  });

  await writeAudit(
    prisma,
    'employee_create',
    { employeeId: user.employeeId },
    actor.id,
  );

  return {
    ...toEmployee(user),
    quotas: await buildQuotas(user.id),
  };
}

export async function updateEmployee(
  actor: AuthUser,
  employeeId: string,
  body: EmployeeUpdateBody,
) {
  assertEmployeeId(employeeId);
  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', '找不到員工');
  }

  if (user.isProtected && body.isActive === false) {
    throw new AppError(403, 'ADMIN_PROTECTED', '受保護的 Admin 不可停用');
  }

  if (body.pin) assertPin(body.pin);

  const data: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', '姓名不可空白');
    }
    data.name = body.name.trim();
  }
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.pin) data.pinHash = await hashSecret(body.pin);
  if (body.password !== undefined) {
    if (user.role !== 'admin') {
      throw new AppError(400, 'VALIDATION_ERROR', '僅 Admin 可設定密碼');
    }
    data.passwordHash = await hashSecret(body.password);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.user.update({
      where: { id: user.id },
      data,
    });
    if (body.quota) {
      await tx.annualLeaveQuota.upsert({
        where: {
          userId_year: { userId: user.id, year: body.quota.year },
        },
        create: {
          userId: user.id,
          year: body.quota.year,
          quotaDays: new Prisma.Decimal(body.quota.quotaDays),
        },
        update: {
          quotaDays: new Prisma.Decimal(body.quota.quotaDays),
        },
      });
    }
    return next;
  });

  await writeAudit(
    prisma,
    'employee_update',
    { employeeId: updated.employeeId, fields: Object.keys(body) },
    actor.id,
  );

  return {
    ...toEmployee(updated),
    quotas: await buildQuotas(updated.id),
  };
}
