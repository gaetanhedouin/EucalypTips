import type { LeaderboardRow, Sport, Window } from '@nouveau/types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000';

export async function fetchLeaderboard(window: Window = 'WEEK', sport?: Sport): Promise<LeaderboardRow[]> {
  try {
    const params = new URLSearchParams({ window, ...(sport ? { sport } : {}) });
    const response = await fetch(`${API_BASE_URL}/v1/public/leaderboard?${params.toString()}`, {
      next: { revalidate: 5 },
    });

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<LeaderboardRow[]>;
  } catch {
    return [];
  }
}

export async function fetchTrainerPerformance(slug: string, window: Window = 'MONTH') {
  try {
    const params = new URLSearchParams({ window });
    const response = await fetch(`${API_BASE_URL}/v1/public/trainers/${slug}/performance?${params.toString()}`, {
      next: { revalidate: 5 },
    });

    if (!response.ok) {
      return [];
    }

    return response.json() as Promise<LeaderboardRow[]>;
  } catch {
    return [];
  }
}
