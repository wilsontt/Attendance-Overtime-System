import { apiFetch } from './client';

export type MeResponse = {
  employeeId: string;
  name: string;
  role: 'employee' | 'admin';
};

export type CaptchaResponse = {
  captchaId: string;
  image: string;
};

export type LoginRequest =
  | {
      mode: 'employee';
      employeeId: string;
      captchaId: string;
      captchaAnswer: string;
    }
  | {
      mode: 'admin';
      username: string;
      password: string;
      captchaId: string;
      captchaAnswer: string;
    };

export async function fetchCaptcha(): Promise<CaptchaResponse> {
  return apiFetch<CaptchaResponse>('/auth/captcha');
}

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
