import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/lib/password.js';
import { ADMIN_EMPLOYEE_ID } from '../src/config.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMeAdmin!';
  const adminPin = process.env.ADMIN_SEED_PIN ?? '0000';

  const pinHash = await hashSecret(adminPin);
  const passwordHash = await hashSecret(adminPassword);

  await prisma.user.upsert({
    where: { employeeId: ADMIN_EMPLOYEE_ID },
    create: {
      employeeId: ADMIN_EMPLOYEE_ID,
      name: '系統管理員',
      role: 'admin',
      pinHash,
      passwordHash,
      isActive: true,
      isProtected: true,
    },
    update: {
      pinHash,
      passwordHash,
      isProtected: true,
      isActive: true,
      role: 'admin',
    },
  });

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
