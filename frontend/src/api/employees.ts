import { apiFetch } from './client';

export type Employee = {
  employeeId: string;
  name: string;
  role: 'employee' | 'admin';
  isActive: boolean;
  /** 當前年（西元） */
  quotaYear: number;
  /** 當前年年假額度；無紀錄時為 null */
  quotaDays: number | null;
};

export type AnnualLeaveQuota = {
  year: number;
  quotaDays: number;
  usedDays: number;
  remainingDays: number;
};

export type EmployeeDetail = Employee & {
  quotas: AnnualLeaveQuota[];
};

export async function listEmployees(
  activeOnly = false,
): Promise<{ items: Employee[] }> {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return apiFetch<{ items: Employee[] }>(`/admin/employees${qs}`);
}

export async function getEmployee(
  employeeId: string,
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/admin/employees/${employeeId}`);
}

export async function createEmployee(body: {
  employeeId: string;
  name: string;
  isActive?: boolean;
  quotaYear?: number;
  quotaDays?: number;
}): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>('/admin/employees', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateEmployee(
  employeeId: string,
  body: {
    name?: string;
    isActive?: boolean;
    password?: string;
    quota?: { year: number; quotaDays: number };
  },
): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/admin/employees/${employeeId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
