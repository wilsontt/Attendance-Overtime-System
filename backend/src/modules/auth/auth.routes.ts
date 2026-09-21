import type { FastifyInstance } from 'fastify';
import {
  getMePayload,
  login,
  logout,
  requireAuth,
  type LoginBody,
} from './auth.service.js';
import { createCaptcha } from './captcha.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/captcha', async (_request, reply) => {
    return reply.send(createCaptcha());
  });

  app.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const result = await login(request.body, reply);
    return reply.send(result);
  });

  app.post('/api/auth/logout', async (request, reply) => {
    // 允許過期／無效 session 仍清 Cookie（不要求 requireAuth）
    await logout(request, reply);
    return reply.status(204).send();
  });

  app.get('/api/me', async (request, reply) => {
    const user = await requireAuth(request);
    return reply.send(getMePayload(user));
  });
}
