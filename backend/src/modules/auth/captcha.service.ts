import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors.js';

const TTL_MS = 5 * 60 * 1000;

type CaptchaEntry = {
  answer: string;
  expiresAt: number;
};

const store = new Map<string, CaptchaEntry>();

/**
 * 七段顯示器 segment 順序：a(上) b(右上) c(右下) d(下) e(左下) f(左上) g(中)
 * 座標相對 digit 原點 (0,0)，寬 20、高 32。
 */
const SEGMENTS: Record<string, string> = {
  a: 'M2,2 H18 V5 H2 Z',
  b: 'M15,3 H18 V15 H15 Z',
  c: 'M15,17 H18 V29 H15 Z',
  d: 'M2,27 H18 V30 H2 Z',
  e: 'M2,17 H5 V29 H2 Z',
  f: 'M2,3 H5 V15 H2 Z',
  g: 'M2,14.5 H18 V17.5 H2 Z',
};

const DIGIT_SEGMENTS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

function purgeExpired(now = Date.now()): void {
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

function digitPaths(digit: string, offsetX: number, fill: string): string {
  const segments = DIGIT_SEGMENTS[digit] ?? DIGIT_SEGMENTS['0']!;
  return segments
    .map((name) => {
      const d = SEGMENTS[name]!;
      return `<path transform="translate(${offsetX},20)" d="${d}" fill="${fill}"/>`;
    })
    .join('');
}

/**
 * 以七段 path 繪製驗證碼（不含 <text> 數字明文，避免 base64 直接解出答案）。
 */
function buildSvg(answer: string): string {
  const colors = ['#dc2626', '#16a34a', '#2563eb', '#ea580c'];
  const digits = answer.split('');
  const digitSvg = digits
    .map((ch, i) => {
      const x = 28 + i * 42;
      const fill = colors[i % colors.length] ?? '#111';
      return digitPaths(ch, x, fill);
    })
    .join('');
  const noise = Array.from({ length: 5 }, () => {
    const x1 = randomInt(0, 200);
    const y1 = randomInt(0, 72);
    const x2 = randomInt(0, 200);
    const y2 = randomInt(0, 72);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e5e7eb" stroke-width="2"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="72" viewBox="0 0 200 72"><rect width="200" height="72" fill="#fff"/>${noise}${digitSvg}</svg>`;
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
