import { describe, expect, it } from 'vitest';
import {
  computeLockUntil,
  isLoginLocked,
  nextFailedLoginState,
} from '../src/lib/audit.js';
import { MAX_FAILED_LOGINS } from '../src/config.js';

describe('login lock helpers', () => {
  it('isLoginLocked is true only when lockedUntil is in the future', () => {
    const now = new Date('2026-09-18T10:00:00Z');
    expect(isLoginLocked({ lockedUntil: null }, now)).toBe(false);
    expect(
      isLoginLocked({ lockedUntil: new Date('2026-09-18T09:59:00Z') }, now),
    ).toBe(false);
    expect(
      isLoginLocked({ lockedUntil: new Date('2026-09-18T10:01:00Z') }, now),
    ).toBe(true);
  });

  it('locks after MAX_FAILED_LOGINS failures', () => {
    const now = new Date('2026-09-18T10:00:00Z');
    const before = nextFailedLoginState(MAX_FAILED_LOGINS - 2, now);
    expect(before.failedLoginCount).toBe(MAX_FAILED_LOGINS - 1);
    expect(before.lockedUntil).toBeNull();

    const locked = nextFailedLoginState(MAX_FAILED_LOGINS - 1, now);
    expect(locked.failedLoginCount).toBe(MAX_FAILED_LOGINS);
    expect(locked.lockedUntil?.getTime()).toBe(computeLockUntil(now).getTime());
  });
});
