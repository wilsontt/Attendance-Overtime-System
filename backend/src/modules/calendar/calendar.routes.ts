import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors.js';
import { requireAdmin, requireAuth } from '../auth/auth.service.js';
import { syncGovCalendar } from './govCalendar.service.js';
import { getLeaveCalendar } from './leaveCalendar.service.js';

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { employeeId?: string; year?: string; month?: string };
  }>('/api/leave/calendar', async (request, reply) => {
    const actor = await requireAuth(request);
    const year = Number(request.query.year);
    if (!request.query.year || Number.isNaN(year)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'year 必填');
    }
    const month =
      request.query.month != null && request.query.month !== ''
        ? Number(request.query.month)
        : undefined;
    if (request.query.month != null && request.query.month !== '' && Number.isNaN(month)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'month 無效');
    }

    return reply.send(
      await getLeaveCalendar(actor, {
        employeeId: request.query.employeeId,
        year,
        month,
      }),
    );
  });

  app.post<{ Body: { year?: number } }>(
    '/api/admin/gov-calendar/sync',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      const result = await syncGovCalendar(actor, request.body?.year);
      return reply.send(result);
    },
  );
}
