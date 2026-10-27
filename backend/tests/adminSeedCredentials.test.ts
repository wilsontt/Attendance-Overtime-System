import { describe, expect, it } from 'vitest';
import { resolveAdminSeedCredentials } from '../src/lib/adminSeedCredentials.js';

const STRONG = 'Abcdefgh1234!';

describe('resolveAdminSeedCredentials', () => {
  it('未設定 ADMIN_SEED_PASSWORD 時拋例外', () => {
    expect(() => resolveAdminSeedCredentials({})).toThrow('未設定');
  });

  it('空白密碼視為未設定', () => {
    expect(() =>
      resolveAdminSeedCredentials({ ADMIN_SEED_PASSWORD: '   ' }),
    ).toThrow('未設定');
  });

  it('弱密碼拋例外，且訊息不含該密碼', () => {
    const weak = 'weakpass';
    let message = '';
    try {
      resolveAdminSeedCredentials({ ADMIN_SEED_PASSWORD: weak });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('不符合強度規則');
    expect(message).not.toContain(weak);
  });

  it('未設定 PIN 時產生 32 字元十六進位隨機值，且每次不同', () => {
    const env = { ADMIN_SEED_PASSWORD: STRONG };
    const first = resolveAdminSeedCredentials(env);
    const second = resolveAdminSeedCredentials(env);
    expect(first.password).toBe(STRONG);
    expect(first.pin).toMatch(/^[0-9a-f]{32}$/);
    expect(second.pin).not.toBe(first.pin);
  });

  it('PIN 空字串視為未設定', () => {
    const result = resolveAdminSeedCredentials({
      ADMIN_SEED_PASSWORD: STRONG,
      ADMIN_SEED_PIN: '',
    });
    expect(result.pin).toMatch(/^[0-9a-f]{32}$/);
  });

  it('有設定 PIN 時原樣使用', () => {
    const result = resolveAdminSeedCredentials({
      ADMIN_SEED_PASSWORD: STRONG,
      ADMIN_SEED_PIN: '1234',
    });
    expect(result.pin).toBe('1234');
  });
});
