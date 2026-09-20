import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../auth/auth.service.js';
import {
  importAttendanceFile,
  listAttendance,
} from './attendance.service.js';

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });

  app.post('/api/attendance/import', async (request, reply) => {
    const actor = await requireAuth(request);
    const file = await request.file();
    if (!file) {
      throw new AppError(400, 'VALIDATION_ERROR', '請上傳 file 欄位（CSV 或 TXT）');
    }

    const buffer = await file.toBuffer();
    const content = buffer.toString('utf8');
    const filename = file.filename || 'upload.txt';

    const result = await importAttendanceFile(actor, filename, content);
    return reply.send(result);
  });

  app.get<{
    Querystring: { employeeId?: string; dateFrom?: string; dateTo?: string };
  }>('/api/attendance', async (request, reply) => {
    const actor = await requireAuth(request);
    return reply.send(await listAttendance(actor, request.query));
  });
}
