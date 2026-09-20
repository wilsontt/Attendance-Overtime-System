import { apiFetch } from './client';

export type WorkLocationTerm = {
  id: string;
  text: string;
  createdAt: string;
};

export async function searchWorkLocations(
  q: string,
  limit = 20,
): Promise<WorkLocationTerm[]> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const result = await apiFetch<{ items: WorkLocationTerm[] }>(
    `/work-locations?${qs.toString()}`,
  );
  return result.items;
}

export async function upsertWorkLocation(
  text: string,
): Promise<WorkLocationTerm> {
  return apiFetch<WorkLocationTerm>('/work-locations', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
