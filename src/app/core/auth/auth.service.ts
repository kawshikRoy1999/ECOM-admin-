import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { CompanyDtl, LoginRequest, MenuActionsResponse, MenuMasterItem, SessionUser } from './auth.models';

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

  /** Role-permitted menus, or null when unknown (older session / call failed → fail-open). */
  readonly permittedMenus = computed(() => this._user()?.permittedMenus ?? null);

  /**
   * True if the user may see a menu matching any of the given tokens.
   *
   * Fail-open by design so nothing new gets hidden accidentally:
   *  - super admins, and sessions with no permission data, see everything;
   *  - a menu that is NOT in the company menu master (i.e. not managed by the
   *    permission system / not in the DB) is always visible;
   *  - only a menu that IS in the master but is NOT permitted for the role is hidden.
   * Tokens are matched (case-insensitive substring) against each menu's NAME only.
   * (The .NET `url` values are MVC routes and don't map to Angular routes, so they're ignored.)
   */
  canAccess(tokens: string[]): boolean {
    const u = this._user();
    if (!u || u.isSuperAdmin) return true;
    const permitted = u.permittedMenus;
    if (!permitted || permitted.length === 0) return true; // no data → don't lock out
    if (!tokens.length) return true;

    const toks = tokens.map((t) => t.toLowerCase());
    const matches = (m: { menuName?: string }) => {
      const name = (m.menuName ?? '').toLowerCase();
      return toks.some((t) => name.includes(t));
    };

    const master = u.menuMaster;
    if (!master || master.length === 0) return true; // master unknown → show by default
    if (!master.some(matches)) return true;          // not in the DB menu master → show
    return permitted.some(matches);                  // managed by permissions → require a grant
  }

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
      // Load the role-based menu/action permissions (mirrors .NET GetPermittedMenusAndActions).
      switchMap((user) =>
        this.api.post<MenuActionsResponse>('UserManagement/MenuActions', { UserId: user.id }).pipe(
          catchError(() => of(null)),
          tap((res) => {
            if (res) {
              user.permittedMenus = res.permittedMenus ?? [];
              user.permittedActions = res.permittedActions ?? [];
              this.persistSession(user);
            }
          }),
          switchMap(() => of(user)),
        ),
      ),
      // Load the full company menu master so we can tell "denied" from "not in DB".
      switchMap((user) =>
        this.api
          .post<{ menu?: MenuMasterItem[] }>('UserManagement/GetMenuList', {
            CompanyId: user.companyId,
            MenuName: '',
            Pagenumber: 1,
            RecordPerPage: 1000,
            ActionType: 0,
          })
          .pipe(
            catchError(() => of(null)),
            tap((res) => {
              if (res?.menu) {
                user.menuMaster = res.menu.map((m) => ({ menuName: m.menuName, url: m.url }));
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
