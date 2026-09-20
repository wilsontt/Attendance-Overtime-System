import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors.js';

const TTL_MS = 5 * 60 * 1000;

type CaptchaEntry = {
  answer: string;
  expiresAt: number;
};

const store = new Map<string, CaptchaEntry>();

function purgeExpired(now = Date.now()): void {
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function buildSvg(answer: string): string {
  const colors = ['#dc2626', '#16a34a', '#2563eb', '#ea580c'];
  const chars = answer.split('');
  const texts = chars
    .map((ch, i) => {
      const x = 28 + i * 42;
      const y = 48 + (i % 2 === 0 ? -4 : 4);
      const fill = colors[i % colors.length] ?? '#111';
      return `<text x="${x}" y="${y}" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="${fill}">${ch}</text>`;
    })
    .join('');
  const noise = Array.from({ length: 5 }, () => {
    const x1 = randomInt(0, 200);
    const y1 = randomInt(0, 72);
    const x2 = randomInt(0, 200);
    const y2 = randomInt(0, 72);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e5e7eb" stroke-width="2"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="72" viewBox="0 0 200 72"><rect width="200" height="72" fill="#fff"/>${noise}${texts}</svg>`;
}

export type CaptchaPayload = {
  captchaId: string;
  image: string;
};

/**
 * 產生圖形驗證碼（SVG data URL），對齊教育訓練 4 碼數字挑戰。
 */
export function createCaptcha(): CaptchaPayload {
  purgeExpired();
  const answer = String(randomInt(0, 10000)).padStart(4, '0');
  const captchaId = randomUUID();
  store.set(captchaId, {
    answer,
    expiresAt: Date.now() + TTL_MS,
  });
  const svg = buildSvg(answer);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  return { captchaId, image };
}

/**
 * 驗證並消耗 captcha（一次性）。成功回 true；失敗拋 401。
 */
export function consumeCaptcha(captchaId: string, answer: string): void {
  purgeExpired();
  if (!captchaId || !/^\d{4}$/.test(answer)) {
    throw new AppError(400, 'VALIDATION_ERROR', '驗證碼格式錯誤');
  }
  const entry = store.get(captchaId);
  if (!entry) {
    throw new AppError(401, 'UNAUTHORIZED', '驗證碼已過期或不存在，請重新取得');
  }
  store.delete(captchaId);
  if (entry.answer !== answer) {
    throw new AppError(401, 'UNAUTHORIZED', '驗證碼錯誤');
  }
}

/** 測試用：清空暫存 */
export function clearCaptchaStoreForTests(): void {
  store.clear();
}

/** 測試用：寫入已知答案 */
export function putCaptchaForTests(captchaId: string, answer: string): void {
  store.set(captchaId, { answer, expiresAt: Date.now() + TTL_MS });
}
