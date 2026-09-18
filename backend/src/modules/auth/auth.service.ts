import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User, UserRole } from '@prisma/client';
import {
  LOCK_MINUTES,
  SESSION_COOKIE,
  SESSION_TTL_HOURS,
  isCookieSecure,
} from '../../config.js';
import { AppError } from '../../lib/errors.js';
import {
  isLoginLocked,
  nextFailedLoginState,
  writeAudit,
} from '../../lib/audit.js';
import { verifySecret } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';

export type AuthUser = {
  id: string;
  employeeId: string;
  name: string;
  role: UserRole;
};

export type LoginBody =
  | { mode: 'employee'; employeeId: string; pin: string }
  | { mode: 'admin'; username: string; password: string; pin: string };

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

function toMe(user: Pick<User, 'employeeId' | 'name' | 'role'>) {
  return {
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
  };
}

function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function login(
  body: LoginBody,
  reply: FastifyReply,
): Promise<ReturnType<typeof toMe>> {
  const now = new Date();
  let user: User | null = null;

  if (body.mode === 'employee') {
    if (!/^\d{6}$/.test(body.employeeId) || !/^\d{4}$/.test(body.pin)) {
      throw new AppError(400, 'VALIDATION_ERROR', '員工編號或 PIN 格式錯誤');
    }
    user = await prisma.user.findUnique({
      where: { employeeId: body.employeeId },
    });
  } else {
    if (!body.username || !body.password || !/^\d{4}$/.test(body.pin)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Admin 登入欄位不完整');
    }
    user = await prisma.user.findFirst({
      where: {
        OR: [{ employeeId: body.username }, { name: body.username }],
        role: 'admin',
      },
    });
  }

  if (!user || !user.isActive) {
    await writeAudit(prisma, 'login_failed', {
      mode: body.mode,
      reason: 'not_found_or_inactive',
    });
    throw new AppError(401, 'UNAUTHORIZED', '帳號或驗證碼錯誤');
  }

  if (isLoginLocked(user, now)) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(((user.lockedUntil?.getTime() ?? now.getTime()) - now.getTime()) / 1000),
    );
    throw new AppError(423, 'LOGIN_LOCKED', '登入嘗試過多，請稍後再試', {
      retryAfterSeconds,
    });
  }

  let ok = await verifySecret(body.pin, user.pinHash);

  if (body.mode === 'admin') {
    if (!user.passwordHash) {
      ok = false;
    } else {
      const passwordOk = await verifySecret(body.password, user.passwordHash);
      ok = ok && passwordOk;
    }
  }

  if (!ok) {
    const next = nextFailedLoginState(user.failedLoginCount, now);
    await prisma.user.update({
      where: { id: user.id },
      data: next,
    });
    await writeAudit(prisma, 'login_failed', {
      mode: body.mode,
      employeeId: user.employeeId,
      failedLoginCount: next.failedLoginCount,
    });
    if (next.lockedUntil) {
      throw new AppError(423, 'LOGIN_LOCKED', '登入嘗試過多，請稍後再試', {
        retryAfterSeconds: LOCK_MINUTES * 60,
      });
    }
    throw new AppError(401, 'UNAUTHORIZED', '帳號或驗證碼錯誤');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: sessionExpiry(now),
    },
  });

  reply.setCookie(SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isCookieSecure(),
    expires: session.expiresAt,
  });

  await writeAudit(
    prisma,
    'login_success',
    { mode: body.mode, employeeId: user.employeeId },
    user.id,
  );

  return toMe(user);
}

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function resolveAuthUser(
  request: FastifyRequest,
): Promise<AuthUser | null> {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    employeeId: session.user.employeeId,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  const user = await resolveAuthUser(request);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', '請先登入');
  }
  request.authUser = user;
  return user;
}

export async function requireAdmin(request: FastifyRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', '權限不足');
  }
  return user;
}

export function getMePayload(user: AuthUser) {
  return {
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
  };
}
