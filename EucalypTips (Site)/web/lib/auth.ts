'use client';

import type { AuthMe } from '@nouveau/types';
import { API_BASE_URL } from './api';

export const SITE_ACCESS_TOKEN_KEY = 'eucalyptips.site.auth.accessToken';
export const SITE_REFRESH_TOKEN_KEY = 'eucalyptips.site.auth.refreshToken';

export function getSiteAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(SITE_ACCESS_TOKEN_KEY);
}

export function getSiteRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(SITE_REFRESH_TOKEN_KEY);
}

export function setSiteTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SITE_ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(SITE_REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSiteTokens(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(SITE_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(SITE_REFRESH_TOKEN_KEY);
}

export async function refreshSiteSession(): Promise<boolean> {
  const refreshToken = getSiteRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSiteTokens();
    return false;
  }

  const payload = (await response.json().catch(() => null)) as
    | { accessToken?: string; refreshToken?: string }
    | null;

  if (!payload?.accessToken || !payload?.refreshToken) {
    clearSiteTokens();
    return false;
  }

  setSiteTokens(payload.accessToken, payload.refreshToken);
  return true;
}

export async function authedSiteFetch(path: string, init?: RequestInit, canRetry = true): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const accessToken = getSiteAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (response.status === 401 && canRetry) {
    const refreshed = await refreshSiteSession();
    if (refreshed) {
      return authedSiteFetch(path, init, false);
    }
  }

  return response;
}

export async function fetchSiteMe(): Promise<AuthMe | null> {
  if (!getSiteAccessToken() && !getSiteRefreshToken()) {
    return null;
  }

  if (!getSiteAccessToken() && getSiteRefreshToken()) {
    await refreshSiteSession();
  }

  const response = await authedSiteFetch('/v1/me');
  if (!response.ok) {
    clearSiteTokens();
    return null;
  }

  return (await response.json()) as AuthMe;
}

export async function logoutSiteSession(): Promise<void> {
  const refreshToken = getSiteRefreshToken();

  await fetch(`${API_BASE_URL}/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => undefined);

  clearSiteTokens();
}

export async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join(', ');
    }
  } catch {
    // no-op
  }

  try {
    const text = await response.text();
    if (text) {
      return text;
    }
  } catch {
    // no-op
  }

  return fallback;
}
