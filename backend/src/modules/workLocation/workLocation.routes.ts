import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../auth/auth.service.js';
import {
  searchWorkLocations,
  upsertWorkLocation,
} from './workLocation.service.js';

export async function workLocationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string; limit?: string } }>(
    '/api/work-locations',
    async (request, reply) => {
      await requireAuth(request);
      if (!request.query.q) {
        throw new AppError(400, 'VALIDATION_ERROR', 'q 必填');
      }
      const limit =
        request.query.limit != null && request.query.limit !== ''
          ? Number(request.query.limit)
          : 20;
      if (Number.isNaN(limit)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'limit 無效');
      }
      return reply.send(await searchWorkLocations(request.query.q, limit));
    },
  );

  app.post<{ Body: { text?: string } }>(
    '/api/work-locations',
    async (request, reply) => {
      const actor = await requireAuth(request);
      if (!request.body?.text) {
        throw new AppError(400, 'VALIDATION_ERROR', 'text 必填');
      }
      const { term, created } = await upsertWorkLocation(
        actor,
        request.body.text,
      );
      return reply.status(created ? 201 : 200).send(term);
    },
  );
}
