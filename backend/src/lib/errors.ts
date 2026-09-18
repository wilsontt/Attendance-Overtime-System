export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'LOGIN_LOCKED'
  | 'IMPORT_NOT_SELF'
  | 'UNKNOWN_LEAVE_TYPE'
  | 'SHIFT_IN_USE'
  | 'SHIFT_HAS_ACTIVE_ASSIGNMENT'
  | 'ADMIN_PROTECTED'
  | 'CONFLICT';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorBody(error: AppError): {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  return {
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };
}
