import { apiFetch } from './client';

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'disabled';
};

export type ShiftAssignment = {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export async function listShifts(includeDisabled = true): Promise<Shift[]> {
  const data = await apiFetch<{ items: Shift[] }>(
    `/admin/shifts?includeDisabled=${includeDisabled ? 'true' : 'false'}`,
  );
  return data.items;
}

export async function createShift(body: {
  name: string;
  startTime: string;
  endTime: string;
}): Promise<Shift> {
  return apiFetch<Shift>('/admin/shifts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateShift(
  shiftId: string,
  body: Partial<{
    name: string;
    startTime: string;
    endTime: string;
    status: 'active' | 'disabled';
  }>,
): Promise<Shift> {
  return apiFetch<Shift>(`/admin/shifts/${shiftId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteShift(shiftId: string): Promise<void> {
  await apiFetch<void>(`/admin/shifts/${shiftId}`, { method: 'DELETE' });
}

export async function listAssignments(
  employeeId?: string,
): Promise<ShiftAssignment[]> {
  const q = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  const data = await apiFetch<{ items: ShiftAssignment[] }>(
    `/admin/shift-assignments${q}`,
  );
  return data.items;
}

export async function createAssignment(body: {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}): Promise<ShiftAssignment> {
  return apiFetch<ShiftAssignment>('/admin/shift-assignments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  await apiFetch<void>(`/admin/shift-assignments/${assignmentId}`, {
    method: 'DELETE',
  });
}
