import "server-only";

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/observability/logger";

export type ApiErrorCode =
  | "bad_request"
  | "bad_gateway"
  | "forbidden"
  | "internal_error"
  | "not_found"
  | "not_implemented"
  | "unauthorized"
  | "validation_error";

export type ApiErrorBody = {
  code: ApiErrorCode;
  details?: unknown;
  message: string;
};

export type ApiSuccessBody<TData extends Record<string, unknown>> = TData & {
  data: TData;
  error: null;
};

export type CanonicalApiSuccessBody<TData extends Record<string, unknown>> = {
  data: TData;
  error: null;
};

export type ApiFailureBody = {
  data: null;
  error: ApiErrorBody;
};

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;
  status: number;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type ApiResult<TData extends Record<string, unknown>> =
  | ApiSuccessBody<TData>
  | ApiFailureBody;

export function apiSuccess<TData extends Record<string, unknown>>(
  data: TData,
  init?: ResponseInit
) {
  return NextResponse.json<ApiSuccessBody<TData>>(
    {
      ...data,
      data,
      error: null
    },
    init
  );
}

export function apiCanonicalSuccess<TData extends Record<string, unknown>>(
  data: TData,
  init?: ResponseInit
) {
  return NextResponse.json<CanonicalApiSuccessBody<TData>>(
    {
      data,
      error: null
    },
    init
  );
}

export function apiFailure(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json<ApiFailureBody>(
    {
      data: null,
      error: {
        code,
        details,
        message
      }
    },
    { status }
  );
}

export function unauthorized(message = "Unauthorized") {
  return apiFailure("unauthorized", message, 401);
}

export function validationFailure(message: string, details?: unknown) {
  return apiFailure("validation_error", message, 400, details);
}

export function handleApiError(error: unknown, route: string) {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logApiError({ error, route, status: error.status });
    }

    return apiFailure(error.code, error.message, error.status, error.details);
  }

  logApiError({ error, route, status: 500 });
  return apiFailure("internal_error", "Unexpected server error.", 500);
}
