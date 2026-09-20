import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { AppError, toErrorBody } from './lib/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { employeeRoutes } from './modules/employee/employee.routes.js';
import { shiftRoutes } from './modules/shift/shift.routes.js';
import { computationRoutes } from './modules/computation/computation.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cookie);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(toErrorBody(error));
    }
    app.log.error(error);
    return reply.status(500).send({
      code: 'VALIDATION_ERROR',
      message: '伺服器內部錯誤',
    });
  });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(employeeRoutes);
  await app.register(shiftRoutes);
  await app.register(computationRoutes);
  await app.register(attendanceRoutes);

  return app;
}
