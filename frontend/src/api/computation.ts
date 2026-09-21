import { apiFetch } from './client';
import type { Shift } from './shifts';

export type DayType = 'weekday' | 'rest_day' | 'holiday' | 'make_up';

export type DayComputationContext = {
  date: string;
  dayType: DayType;
  shift: Shift | null;
};

export type ComputationContextResponse = {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  days: DayComputationContext[];
};

export async function fetchComputationContext(params: {
  employeeId?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ComputationContextResponse> {
  const search = new URLSearchParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  if (params.employeeId) search.set('employeeId', params.employeeId);
  return apiFetch<ComputationContextResponse>(
    `/computation-context?${search.toString()}`,
  );
}
