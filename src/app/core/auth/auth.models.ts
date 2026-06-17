/**
 * Auth contract — ADJUST these to match your .NET admin API.
 *
 * Right now this assumes:
 *   POST {apiUrl}/auth/login
 *   body:     { email, password }
 *   response: { token, user: { id, name, email, role } }
 *
 * Send me your real endpoint + request/response shape and I'll update this file.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
