import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/lib/password.js';
import { ADMIN_EMPLOYEE_ID } from '../src/config.js';
import { resolveAdminSeedCredentials } from '../src/lib/adminSeedCredentials.js';

const prisma = new PrismaClient();

/**
 * 確保 Admin 存在。
 * - 不存在：以 ADMIN_SEED_PASSWORD 建立（必填、須符合強度規則、無預設值）。
 * - 已存在：只維持保護屬性，絕不覆寫 passwordHash / pinHash（改密碼請用 reset-admin-password）。
 */
async function ensureAdmin(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { employeeId: ADMIN_EMPLOYEE_ID },
  });

  if (!existing) {
    const { password, pin } = resolveAdminSeedCredentials(process.env);
    await prisma.user.create({
      data: {
        employeeId: ADMIN_EMPLOYEE_ID,
        name: '系統管理員',
        role: 'admin',
        pinHash: await hashSecret(pin),
        passwordHash: await hashSecret(password),
        isActive: true,
        isProtected: true,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { isProtected: true, isActive: true, role: 'admin' },
  });
}

async function main(): Promise<void> {
  await ensureAdmin();

  await prisma.shift.upsert({
    where: { name: '公司班' },
    create: {
      name: '公司班',
      startTime: '09:00',
      endTime: '18:00',
      status: 'active',
    },
    update: {
      startTime: '09:00',
      endTime: '18:00',
      status: 'active',
    },
  });

  await prisma.shift.upsert({
    where: { name: '倉庫班' },
    create: {
      name: '倉庫班',
      startTime: '08:00',
      endTime: '17:00',
      status: 'active',
    },
    update: {
      startTime: '08:00',
      endTime: '17:00',
      status: 'active',
    },
  });

  console.log('Seed 完成：Admin(000000)、公司班、倉庫班');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
