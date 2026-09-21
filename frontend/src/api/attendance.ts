import { apiFetch, ApiError } from './client';

export type AttendanceDay = {
  employeeId: string;
  name: string;
  belongDate: string;
  attendanceType: string | null;
  leaveQuantity: number;
  clockIn: string | null;
  clockOut: string | null;
  unknownLeaveType: boolean;
};

export type AttendanceImportResult = {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  importedCount: number;
  unknownLeaveTypes: string[];
  quotaAfter: Array<{
    year: number;
    quotaDays: number;
    usedDays: number;
    remainingDays: number;
  }>;
};

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, '')}/api`;

/**
 * multipart 正式匯入（勿手動設 Content-Type，讓瀏覽器帶 boundary）。
 */
export async function importAttendanceFile(
  file: File,
): Promise<AttendanceImportResult> {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch(`${API_BASE}/attendance/import`, {
    method: 'POST',
    credentials: 'include',
    body,
  });

  const data: unknown = await response.json().catch(() => ({
    code: 'VALIDATION_ERROR',
    message: '無法解析伺服器回應',
  }));

  if (!response.ok) {
    const err = data as { code?: string; message?: string; details?: Record<string, unknown> };
    throw new ApiError(response.status, {
      code: err.code ?? 'VALIDATION_ERROR',
      message: err.message ?? '匯入失敗',
      details: err.details,
    });
  }

  return data as AttendanceImportResult;
}

export async function listAttendance(params?: {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ items: AttendanceDay[] }> {
  const qs = new URLSearchParams();
  if (params?.employeeId) qs.set('employeeId', params.employeeId);
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ items: AttendanceDay[] }>(`/attendance${suffix}`);
}
