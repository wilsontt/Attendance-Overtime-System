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
import { consumeCaptcha } from './captcha.service.js';

export type AuthUser = {
  id: string;
  employeeId: string;
  name: string;
  role: UserRole;
};

export type LoginBody =
  | {
      mode: 'employee';
      employeeId: string;
      captchaId: string;
      captchaAnswer: string;
    }
  | {
      mode: 'admin';
      username: string;
      password: string;
      captchaId: string;
      captchaAnswer: string;
    };

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

/**
 * 員工登入通道不可用於 Admin（須走帳密＋驗證碼，避免繞過密碼）。
 */
export function isEmployeeLoginAllowed(
  user: Pick<User, 'role'>,
): boolean {
  return user.role !== 'admin';
}

function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
}

function assertLoginBody(body: LoginBody): asserts body is LoginBody {
  if (!body || typeof body !== 'object' || !('mode' in body)) {
    throw new AppError(400, 'VALIDATION_ERROR', '登入欄位不完整');
  }
}

async function findUserForLogin(body: LoginBody): Promise<User | null> {
  if (body.mode === 'employee') {
    if (!/^\d{6}$/.test(body.employeeId)) {
      throw new AppError(400, 'VALIDATION_ERROR', '員工編號格式錯誤');
    }
    consumeCaptcha(body.captchaId, body.captchaAnswer);
    return prisma.user.findUnique({
      where: { employeeId: body.employeeId },
    });
  }

  if (body.mode === 'admin') {
    if (!body.username || !body.password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Admin 登入欄位不完整');
    }
    consumeCaptcha(body.captchaId, body.captchaAnswer);
    return prisma.user.findFirst({
      where: {
        OR: [{ employeeId: body.username }, { name: body.username }],
        role: 'admin',
      },
    });
  }

  throw new AppError(400, 'VALIDATION_ERROR', '未知登入模式');
}

function isLoginEligible(user: User | null, mode: LoginBody['mode']): user is User {
  if (!user?.isActive) return false;
  if (mode === 'employee' && !isEmployeeLoginAllowed(user)) return false;
  return true;
}

function throwIfLoginLocked(user: User, now: Date): void {
  if (!isLoginLocked(user, now)) return;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(
      ((user.lockedUntil?.getTime() ?? now.getTime()) - now.getTime()) / 1000,
    ),
  );
  throw new AppError(423, 'LOGIN_LOCKED', '登入嘗試過多，請稍後再試', {
    retryAfterSeconds,
  });
}

async function verifyAdminPassword(
  body: Extract<LoginBody, { mode: 'admin' }>,
  user: User,
): Promise<boolean> {
  if (!user.passwordHash) return false;
  return verifySecret(body.password, user.passwordHash);
}

async function rejectFailedPassword(
  user: User,
  mode: LoginBody['mode'],
  now: Date,
): Promise<never> {
  const next = nextFailedLoginState(user.failedLoginCount, now);
  await prisma.user.update({
    where: { id: user.id },
    data: next,
  });
  await writeAudit(prisma, 'login_failed', {
    mode,
    employeeId: user.employeeId,
    failedLoginCount: next.failedLoginCount,
  });
  if (next.lockedUntil) {
    throw new AppError(423, 'LOGIN_LOCKED', '登入嘗試過多，請稍後再試', {
      retryAfterSeconds: LOCK_MINUTES * 60,
    });
  }
  throw new AppError(401, 'UNAUTHORIZED', '帳號或密碼錯誤');
}

async function issueSession(
  user: User,
  mode: LoginBody['mode'],
  reply: FastifyReply,
  now: Date,
): Promise<ReturnType<typeof toMe>> {
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
    { mode, employeeId: user.employeeId },
    user.id,
  );

  return toMe(user);
}

export async function login(
  body: LoginBody,
  reply: FastifyReply,
): Promise<ReturnType<typeof toMe>> {
  const now = new Date();
  assertLoginBody(body);

  const user = await findUserForLogin(body);
  if (!isLoginEligible(user, body.mode)) {
    await writeAudit(prisma, 'login_failed', {
      mode: body.mode,
      reason: 'not_found_or_inactive',
    });
    throw new AppError(401, 'UNAUTHORIZED', '帳號或驗證碼錯誤');
  }

  throwIfLoginLocked(user, now);

  if (body.mode === 'admin') {
    const ok = await verifyAdminPassword(body, user);
    if (!ok) {
      await rejectFailedPassword(user, body.mode, now);
    }
  }

  return issueSession(user, body.mode, reply, now);
}

export async function logout(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isCookieSecure(),
  });
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
      await prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
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
  return toMe(user);
}
