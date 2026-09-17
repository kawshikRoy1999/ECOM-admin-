import { Injectable, Injector, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiError,
  ApiResponse,
  SESSION_EXPIRED_MESSAGE,
  isGatewayAuthFailure,
} from './api.models';
import { AuthService } from '../auth/auth.service';
import { noAuth } from '../auth/skip-auth';

/**
 * Thin wrapper over HttpClient for the gateway. Unwraps the {Status,Message,Data}
 * envelope so callers get `Data` directly, and throws ApiError on Status=false.
 * The bearer token is attached by authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  /** POST {body} to `path` (e.g. 'UserManagement/GetRoleList') and unwrap Data. */
  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}/${path}`, body)
      .pipe(map((res) => this.unwrap(res, path, body)));
  }

  /** GET `path` and unwrap Data. */
  get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}/${path}`)
      .pipe(map((res) => this.unwrap(res, path)));
  }

  /**
   * POST returning the full envelope (when the Message matters to the caller).
   * Pass `skipAuth: true` to send the request token-less (some gateway endpoints
   * behave differently when a bearer token is present — e.g. AddEditItem).
   */
  postRaw<T>(path: string, body: unknown = {}, skipAuth = false): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}/${path}`, body, {
      context: skipAuth ? noAuth() : undefined,
    });
  }

  private unwrap<T>(res: ApiResponse<T>, path: string, body?: unknown): T {
    if (res && res.status === false) {
      console.error(`[ApiService] API request failed on endpoint: ${path}`, {
        requestBody: body,
        response: res,
      });
      throw this.toError(res.message, path);
    }
    return res?.data as T;
  }

  /**
   * Turns an envelope message into an error, bouncing to /login when the
   * gateway has wrapped a downstream 401 into a `status: false` body (those
   * arrive as HTTP 200, so the error interceptor never sees them).
   */
  toError(message: string | undefined, path: string): ApiError {
    if (isGatewayAuthFailure(message)) {
      console.warn(`[ApiService] Gateway reported an auth failure on ${path}; signing out.`);
      // Resolved lazily: AuthService depends on ApiService, so injecting it
      // eagerly here would be a circular dependency.
      this.injector.get(AuthService).logout();
      this.injector.get(Router).navigateByUrl('/login');
      return new ApiError(SESSION_EXPIRED_MESSAGE);
    }
    return new ApiError(message || 'Request failed.');
  }
}
