import { describe, expect, it } from 'vitest';
import { canChangeAdminPassword } from '../src/modules/employee/employee.service.js';

describe('canChangeAdminPassword', () => {
  it('禁止他人變更受保護 Admin 密碼', () => {
    expect(
      canChangeAdminPassword('admin-a', {
        id: 'admin-b',
        isProtected: true,
      }),
    ).toBe(false);
  });

  it('允許本人變更受保護 Admin 密碼', () => {
    expect(
      canChangeAdminPassword('admin-a', {
        id: 'admin-a',
        isProtected: true,
      }),
    ).toBe(true);
  });

  it('非受保護帳號可由他人變更（一般 Admin）', () => {
    expect(
      canChangeAdminPassword('admin-a', {
        id: 'admin-b',
        isProtected: false,
      }),
    ).toBe(true);
  });
});
