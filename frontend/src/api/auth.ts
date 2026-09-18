import { apiFetch } from './client';

export type MeResponse = {
  employeeId: string;
  name: string;
  role: 'employee' | 'admin';
};

export type LoginRequest =
  | { mode: 'employee'; employeeId: string; pin: string }
  | { mode: 'admin'; username: string; password: string; pin: string };

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me');
}

export async function login(body: LoginRequest): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}
