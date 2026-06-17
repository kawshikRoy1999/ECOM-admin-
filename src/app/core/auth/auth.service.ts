import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { CompanyDtl, LoginRequest, SessionUser } from './auth.models';

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

  /** Full URL of the company logo, or '' if none. Built as imageFilePath + logo. */
  readonly logoUrl = computed(() => {
    const u = this._user();
    return u?.logo ? `${u.imageFilePath ?? ''}${u.logo}` : '';
  });

  login(credentials: LoginRequest): Observable<SessionUser> {
    return this.api.post<SessionUser>('UserManagement/authenticate', credentials).pipe(
      // Persist immediately so the auth interceptor can attach the token to GetCompany.
      tap((user) => this.persistSession(user)),
      // Enrich the session with company details (logo, business type) like the .NET flow.
      switchMap((user) =>
        this.api.post<CompanyDtl>('CompanyManagement/GetCompany', { CompanyId: user.companyId }).pipe(
          catchError(() => of(null)),
          tap((company) => {
            if (company) {
              user.imageFilePath = company.imageFilePath;
              user.logo = company.logoFileName;
              user.businessType = company.businessType;
              this.persistSession(user);
            }
          }),
          switchMap(() => of(user)),
        ),
      ),
    );
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
