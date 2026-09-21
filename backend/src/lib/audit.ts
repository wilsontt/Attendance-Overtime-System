import type { Prisma, PrismaClient, User } from '@prisma/client';
import { LOCK_MINUTES, MAX_FAILED_LOGINS } from '../config.js';

export function isLoginLocked(user: Pick<User, 'lockedUntil'>, now = new Date()): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil.getTime() > now.getTime());
}

export function computeLockUntil(now = new Date()): Date {
  return new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
}

export function nextFailedLoginState(
  currentCount: number,
  now = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const failedLoginCount = currentCount + 1;
  if (failedLoginCount >= MAX_FAILED_LOGINS) {
    return { failedLoginCount, lockedUntil: computeLockUntil(now) };
  }
  return { failedLoginCount, lockedUntil: null };
}

export async function writeAudit(
  db: PrismaClient | Prisma.TransactionClient,
  action: string,
  payload: Prisma.InputJsonValue,
  actorId?: string | null,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      payload,
      actorId: actorId ?? null,
    },
  });
}
