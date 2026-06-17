import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { LoginRequest, SessionUser } from './auth.models';

const TOKEN_KEY = 'ecom_admin_token';
const USER_KEY = 'ecom_admin_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly _user = signal<SessionUser | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Convenience accessors needed by every master request. */
  readonly companyId = computed(() => this._user()?.companyId ?? 0);
  readonly userId = computed(() => this._user()?.id ?? '');
  readonly displayName = computed(() => {
    const u = this._user();
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userName;
  });

  login(credentials: LoginRequest): Observable<SessionUser> {
    return this.api
      .post<SessionUser>('UserManagement/authenticate', credentials)
      .pipe(tap((user) => this.persistSession(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private persistSession(user: SessionUser): void {
    localStorage.setItem(TOKEN_KEY, user.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  private readStoredUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }
}
