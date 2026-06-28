import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * When set on a request's HttpContext, the auth interceptor will NOT attach the
 * bearer token. A few gateway endpoints (e.g. ProductManagement/AddEditItem) are
 * called token-less by the .NET app and behave differently when a token is present.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Build an HttpContext that tells the auth interceptor to skip the token. */
export function noAuth(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true);
}
