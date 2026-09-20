import { apiFetch } from './client';

export type LeaveCalendarDay = {
  date: string;
  dayType: 'weekday' | 'rest_day' | 'holiday' | 'make_up';
  leaveType: string | null;
  leaveQuantity: number | null;
  govName?: string | null;
};

export type LeaveCalendarResponse = {
  employeeId: string;
  year: number;
  month: number | null;
  days: LeaveCalendarDay[];
};

export type GovCalendarSyncResult = {
  upsertedCount: number;
  years: number[];
  source: string;
};

export async function fetchLeaveCalendar(params: {
  year: number;
  month?: number;
  employeeId?: string;
}): Promise<LeaveCalendarResponse> {
  const qs = new URLSearchParams();
  qs.set('year', String(params.year));
  if (params.month != null) qs.set('month', String(params.month));
  if (params.employeeId) qs.set('employeeId', params.employeeId);
  return apiFetch<LeaveCalendarResponse>(`/leave/calendar?${qs.toString()}`);
}

export async function syncGovCalendar(
  year?: number,
): Promise<GovCalendarSyncResult> {
  return apiFetch<GovCalendarSyncResult>('/admin/gov-calendar/sync', {
    method: 'POST',
    body: JSON.stringify(year != null ? { year } : {}),
  });
}
