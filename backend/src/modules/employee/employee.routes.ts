import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/auth.service.js';
import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  type EmployeeCreateBody,
  type EmployeeUpdateBody,
} from './employee.service.js';

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { activeOnly?: string } }>(
    '/api/admin/employees',
    async (request, reply) => {
      await requireAdmin(request);
      const activeOnly = request.query.activeOnly === 'true';
      return reply.send(await listEmployees(activeOnly));
    },
  );

  app.post<{ Body: EmployeeCreateBody }>(
    '/api/admin/employees',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      const created = await createEmployee(actor, request.body);
      return reply.status(201).send(created);
    },
  );

  app.get<{ Params: { employeeId: string } }>(
    '/api/admin/employees/:employeeId',
    async (request, reply) => {
      await requireAdmin(request);
      return reply.send(await getEmployee(request.params.employeeId));
    },
  );

  app.patch<{ Params: { employeeId: string }; Body: EmployeeUpdateBody }>(
    '/api/admin/employees/:employeeId',
    async (request, reply) => {
      const actor = await requireAdmin(request);
      return reply.send(
        await updateEmployee(actor, request.params.employeeId, request.body),
      );
    },
  );
}
