import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearCaptchaStoreForTests,
  consumeCaptcha,
  createCaptcha,
  putCaptchaForTests,
} from '../src/modules/auth/captcha.service.js';
import { AppError } from '../src/lib/errors.js';

describe('captcha service', () => {
  beforeEach(() => {
    clearCaptchaStoreForTests();
  });

  it('createCaptcha 回傳 id 與 svg data url', () => {
    const payload = createCaptcha();
    expect(payload.captchaId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(payload.image.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('image 解碼後不得含答案明文（不可直接 regex 取出）', () => {
    for (let i = 0; i < 8; i++) {
      const payload = createCaptcha();
      const b64 = payload.image.replace(/^data:image\/svg\+xml;base64,/, '');
      const svg = Buffer.from(b64, 'base64').toString('utf8');
      expect(svg).not.toMatch(/<text[^>]*>\d<\/text>/);
      expect(svg).not.toMatch(/>\d{4}</);
    }
  });

  it('consumeCaptcha 正確答案通過且一次性', () => {
    putCaptchaForTests('cid-1', '1234');
    consumeCaptcha('cid-1', '1234');
    expect(() => consumeCaptcha('cid-1', '1234')).toThrow(AppError);
  });

  it('consumeCaptcha 錯誤答案拋 401', () => {
    putCaptchaForTests('cid-2', '1234');
    try {
      consumeCaptcha('cid-2', '9999');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });
});
