/** 密碼最小長度。 */
export const PASSWORD_MIN_LENGTH = 12;

/** bcrypt 只取前 72 位元組，超過會被靜默截斷，因此明確拒絕。 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * 檢查密碼強度（長度 ≥ 12，含大寫、小寫、數字、ASCII 符號，且 ≤ 72 位元組）。
 * 所有規則都會檢查，不短路；函式本身不記錄、不輸出輸入值。
 *
 * @param password 待檢查的明文密碼
 * @returns 違規訊息陣列；空陣列代表通過
 */
export function validatePasswordStrength(password: string): string[] {
  const violations: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push(`密碼至少 ${PASSWORD_MIN_LENGTH} 字元`);
  }
  if (!/[A-Z]/.test(password)) {
    violations.push('需包含大寫字母');
  }
  if (!/[a-z]/.test(password)) {
    violations.push('需包含小寫字母');
  }
  if (!/[0-9]/.test(password)) {
    violations.push('需包含數字');
  }
  if (!/[!-/:-@[-`{-~]/.test(password)) {
    violations.push('需包含符號');
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    violations.push(
      `警告：密碼過長（上限 ${PASSWORD_MAX_BYTES} 位元組，中文字每字佔 3 位元組），請縮短`,
    );
  }

  return violations;
}
