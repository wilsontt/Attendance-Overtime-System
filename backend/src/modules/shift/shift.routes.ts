import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/auth.service.js';
import {
  createShift,
  createShiftAssignment,
  deleteShift,
  deleteShiftAssignment,
  listShiftAssignments,
  listShifts,
  updateShift,
  updateShiftAssignment,
  type AssignmentWriteBody,
  type ShiftUpdateBody,
  type ShiftWriteBody,
} from './shift.service.js';

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { includeDisabled?: string } }>(
    '/api/admin/shifts',
    async (request, reply) => {
      await requireAdmin(request);
      const includeDisabled = request.query.includeDisabled !== 'false';
      return reply.send(await listShifts(includeDisabled));
    },
  );

  app.post<{ Body: ShiftWriteBody }>(
    '/api/admin/shifts',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      return reply.status(201).send(await createShift(actor, request.body));
    },
  );

  app.patch<{ Params: { shiftId: string }; Body: ShiftUpdateBody }>(
    '/api/admin/shifts/:shiftId',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      return reply.send(
        await updateShift(actor, request.params.shiftId, request.body),
      );
    },
  );

  app.delete<{ Params: { shiftId: string } }>(
    '/api/admin/shifts/:shiftId',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      await deleteShift(actor, request.params.shiftId);
      return reply.status(204).send();
    },
  );

  app.get<{ Querystring: { employeeId?: string } }>(
    '/api/admin/shift-assignments',
    async (request, reply) => {
      await requireAdmin(request);
      return reply.send(await listShiftAssignments(request.query.employeeId));
    },
  );

  app.post<{ Body: AssignmentWriteBody }>(
    '/api/admin/shift-assignments',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      return reply
        .status(201)
        .send(await createShiftAssignment(actor, request.body));
    },
  );

  app.patch<{ Params: { assignmentId: string }; Body: AssignmentWriteBody }>(
    '/api/admin/shift-assignments/:assignmentId',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      return reply.send(
        await updateShiftAssignment(
          actor,
          request.params.assignmentId,
          request.body,
        ),
      );
    },
  );

  app.delete<{ Params: { assignmentId: string } }>(
    '/api/admin/shift-assignments/:assignmentId',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      await deleteShiftAssignment(actor, request.params.assignmentId);
      return reply.status(204).send();
    },
  );
}
