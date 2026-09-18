import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.service.js';
import { getComputationContext } from './computation.service.js';

export async function computationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { employeeId?: string; dateFrom: string; dateTo: string };
  }>('/api/computation-context', async (request, reply) => {
    const actor = await requireAuth(request);
    if (!request.query.dateFrom || !request.query.dateTo) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'dateFrom 與 dateTo 為必填',
      });
    }
    return reply.send(await getComputationContext(actor, request.query));
  });
}
