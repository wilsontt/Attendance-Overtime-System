export const SESSION_COOKIE = 'attendance_session';
export const SESSION_TTL_HOURS = 8;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const BCRYPT_COST = 12;
export const ADMIN_EMPLOYEE_ID = '000000';

export function getPort(): number {
  return Number(process.env.PORT ?? 3000);
}

export function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}
