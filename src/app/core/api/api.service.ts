import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError, ApiResponse } from './api.models';

/**
 * Thin wrapper over HttpClient for the gateway. Unwraps the {Status,Message,Data}
 * envelope so callers get `Data` directly, and throws ApiError on Status=false.
 * The bearer token is attached by authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  /** POST {body} to `path` (e.g. 'UserManagement/GetRoleList') and unwrap Data. */
  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}/${path}`, body)
      .pipe(map((res) => this.unwrap(res)));
  }

  /** GET `path` and unwrap Data. */
  get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}/${path}`)
      .pipe(map((res) => this.unwrap(res)));
  }

  /** POST returning the full envelope (when the Message matters to the caller). */
  postRaw<T>(path: string, body: unknown = {}): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}/${path}`, body);
  }

  private unwrap<T>(res: ApiResponse<T>): T {
    if (res && res.status === false) {
      throw new ApiError(res.message || 'Request failed.');
    }
    return res?.data as T;
  }
}
