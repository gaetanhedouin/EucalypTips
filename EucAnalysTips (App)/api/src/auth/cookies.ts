import type { Request } from 'express';

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  const pairs = header.split(';');
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = decodeURIComponent(pair.slice(0, index).trim());
    const value = decodeURIComponent(pair.slice(index + 1).trim());
    result[key] = value;
  }

  return result;
}

export function readCookie(request: Request, name: string): string | null {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[name] ?? null;
}
