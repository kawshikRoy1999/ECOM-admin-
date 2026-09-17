/**
 * Standard response envelope returned by the EcomShop gateway.
 * ASP.NET serializes camelCase: { status: bool, message: string, data: T }
 */
export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/** Thrown when the gateway returns status = false. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * True when a `status: false` envelope is really an auth failure.
 *
 * The gateway calls the downstream services itself and catches their
 * WebExceptions, so a downstream 401 comes back as HTTP **200** with
 * `status: false` and the raw .NET exception text in `message`:
 *
 *   "Exception Error: The remote server returned an error: (401) Unauthorized.
 *    StackTrace: ... at EcomShopAPI.Services.ServiceAPI.ProcessPostRequest ..."
 *
 * The HTTP error interceptor never sees these, so they have to be sniffed out
 * of the envelope instead.
 */
export function isGatewayAuthFailure(message: string | undefined | null): boolean {
  if (!message) return false;
  return /\(401\)\s*Unauthorized|\(403\)\s*Forbidden/i.test(message);
}

/** Message shown instead of leaking a .NET stack trace to the user. */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
