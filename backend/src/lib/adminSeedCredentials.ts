import { randomBytes } from 'node:crypto';
import { validatePasswordStrength } from './passwordPolicy.js';

/** seed 建立 Admin 時使用的憑證。 */
export interface AdminSeedCredentials {
  password: string;
  pin: string;
}

/**
 * 從環境變數解析 Admin seed 憑證。僅在資料庫尚無 Admin 時呼叫。
 * 錯誤訊息不包含任何密碼內容。
 *
 * @param env 環境變數（通常為 process.env）
 * @returns 通過強度檢查的密碼，以及 PIN（未設定時為隨機值，不作登入因子）
 * @throws Error ADMIN_SEED_PASSWORD 未設定、空白或不符強度規則
 */
export function resolveAdminSeedCredentials(
  env: NodeJS.ProcessEnv,
): AdminSeedCredentials {
  const password = env.ADMIN_SEED_PASSWORD?.trim();
  if (!password) {
    throw new Error('ADMIN_SEED_PASSWORD 未設定（首次建立 Admin 必填）');
  }

  const violations = validatePasswordStrength(password);
  if (violations.length > 0) {
    throw new Error(
      `ADMIN_SEED_PASSWORD 不符合強度規則：${violations.join('；')}`,
    );
  }

  const pin = env.ADMIN_SEED_PIN?.trim() || randomBytes(16).toString('hex');
  return { password, pin };
}
