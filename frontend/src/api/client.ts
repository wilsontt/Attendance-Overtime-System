export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, '')}/api`;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => ({
    code: 'VALIDATION_ERROR',
    message: '無法解析伺服器回應',
  }));

  if (!response.ok) {
    const body = data as ApiErrorBody;
    throw new ApiError(response.status, {
      code: body.code ?? 'VALIDATION_ERROR',
      message: body.message ?? '請求失敗',
      details: body.details,
    });
  }

  return data as T;
}
