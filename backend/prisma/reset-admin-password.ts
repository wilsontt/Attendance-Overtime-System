/**
 * 重設 Admin 密碼（break-glass，需在主機／容器內以 shell 執行，不提供 Web 端點）。
 *
 * 用法：
 *   ds1（互動輸入，建議）：docker compose exec -it api node dist/prisma/reset-admin-password.js
 *   ds1（環境變數）：     export NEW_ADMIN_PASSWORD='…'
 *                         docker compose exec -e NEW_ADMIN_PASSWORD api node dist/prisma/reset-admin-password.js
 *   本機開發：            npm run admin:reset-password
 *
 * 退出碼：0 成功；1 輸入或前置條件不符；2 未預期錯誤。
 * 任何輸出都不包含明文密碼；NEW_ADMIN_PASSWORD 請勿寫入 .env。
 */
import os from 'node:os';
import { PrismaClient } from '@prisma/client';
import { ADMIN_EMPLOYEE_ID } from '../src/config.js';
import { writeAudit } from '../src/lib/audit.js';
import { hashSecret } from '../src/lib/password.js';
import { validatePasswordStrength } from '../src/lib/passwordPolicy.js';

const prisma = new PrismaClient();

/** 使用者輸入或前置條件不符（退出碼 1）。 */
class UsageError extends Error {}

/**
 * 以不回顯的方式讀取一行輸入（需要 TTY）。
 * @param prompt 提示文字
 */
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let buffer = '';

    const cleanup = (): void => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(buffer);
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new UsageError('已取消'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += ch;
      }
    };

    process.stdout.write(prompt);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** 取得新密碼：NEW_ADMIN_PASSWORD → TTY 隱藏輸入（輸入兩次）。 */
async function obtainNewPassword(): Promise<string> {
  const fromEnv = process.env.NEW_ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new UsageError(
      '非互動環境：請使用 docker compose exec -it，或設定 NEW_ADMIN_PASSWORD',
    );
  }

  const first = await readHidden('新密碼：');
  const second = await readHidden('再輸入一次：');
  if (first !== second) {
    throw new UsageError('兩次輸入不一致');
  }
  return first;
}

/** 取得操作者的 OS 使用者名稱；取不到時退回 uid。 */
function resolveOsUser(): string {
  try {
    return os.userInfo().username;
  } catch {
    return `uid:${process.getuid?.() ?? 'unknown'}`;
  }
}

/** 回報實際連線的 SQLite 檔案路徑，避免誤連到其他資料庫（例如 shell 殘留的 DATABASE_URL）。 */
async function describeTargetDatabase(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ file: string }>>`PRAGMA database_list`;
    return rows[0]?.file || '（無法判斷）';
  } catch {
    return '（無法判斷）';
  }
}

async function main(): Promise<void> {
  console.log(`目標資料庫：${await describeTargetDatabase()}`);
  const password = await obtainNewPassword();

  const violations = validatePasswordStrength(password);
  if (violations.length > 0) {
    throw new UsageError(`密碼不符合強度規則：\n- ${violations.join('\n- ')}`);
  }

  const admin = await prisma.user.findUnique({
    where: { employeeId: ADMIN_EMPLOYEE_ID },
  });
  if (!admin) {
    throw new UsageError(
      '找不到 Admin，請先執行 seed（首次建立需一次性提供 ADMIN_SEED_PASSWORD）',
    );
  }

  const passwordHash = await hashSecret(password);
  const osUser = resolveOsUser();

  const clearedSessions = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: admin.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    const { count } = await tx.session.deleteMany({
      where: { userId: admin.id },
    });
    await writeAudit(
      tx,
      'admin_password_reset',
      {
        employeeId: ADMIN_EMPLOYEE_ID,
        osUser,
        via: 'cli',
        clearedSessions: count,
      },
      null,
    );
    return count;
  });

  console.log(`Admin 密碼已更新（已登出 ${clearedSessions} 個既有登入）`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error('Admin 密碼未變更。');
    process.exitCode = error instanceof UsageError ? 1 : 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
