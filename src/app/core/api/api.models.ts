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
