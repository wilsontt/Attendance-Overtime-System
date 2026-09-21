import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { AppError, toErrorBody } from './lib/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { employeeRoutes } from './modules/employee/employee.routes.js';
import { shiftRoutes } from './modules/shift/shift.routes.js';
import { computationRoutes } from './modules/computation/computation.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { calendarRoutes } from './modules/calendar/calendar.routes.js';
import { workLocationRoutes } from './modules/workLocation/workLocation.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(toErrorBody(error));
    }

    const message =
      error instanceof Error ? error.message : String(error);
    const errorName =
      error instanceof Error
        ? error.name
        : typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            typeof (error as { name: unknown }).name === 'string'
          ? (error as { name: string }).name
          : '';
    const isDbUnreachable =
      /Can't reach database server/i.test(message) ||
      errorName === 'PrismaClientInitializationError';

    app.log.error(error);
    if (isDbUnreachable) {
      return reply.status(503).send({
        code: 'VALIDATION_ERROR',
        message:
          '資料庫無法連線：請確認專案根 data/attendance.db 存在（開發：npm run prisma:migrate && npm run prisma:seed）',
      });
    }
    return reply.status(500).send({
      code: 'VALIDATION_ERROR',
      message: '伺服器內部錯誤',
    });
  });

  app.get('/api/health', async () => ({ ok: true }));

  // 登入／驗證碼較嚴格，降低刷碼與暴力嘗試
  await app.register(
    async (authScope) => {
      await authScope.register(rateLimit, {
        max: 30,
        timeWindow: '1 minute',
      });
      await authScope.register(authRoutes);
    },
  );

  await app.register(employeeRoutes);
  await app.register(shiftRoutes);
  await app.register(computationRoutes);
  await app.register(attendanceRoutes);
  await app.register(calendarRoutes);
  await app.register(workLocationRoutes);

  return app;
}
