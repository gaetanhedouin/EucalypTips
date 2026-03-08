import { ApiClient } from '@nouveau/sdk';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

let token: string | null = null;

export function setAccessToken(next: string | null) {
  token = next;
}

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => token,
});
