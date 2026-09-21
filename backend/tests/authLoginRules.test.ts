import { describe, expect, it } from 'vitest';
import { isEmployeeLoginAllowed } from '../src/modules/auth/auth.service.js';

describe('isEmployeeLoginAllowed', () => {
  it('允許一般員工以員工模式登入', () => {
    expect(isEmployeeLoginAllowed({ role: 'employee' })).toBe(true);
  });

  it('拒絕 Admin 以員工模式登入（不可繞過密碼）', () => {
    expect(isEmployeeLoginAllowed({ role: 'admin' })).toBe(false);
  });
});
