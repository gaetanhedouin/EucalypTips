import type {
  AuthLoginResponse,
  AuthMe,
  AuthRefreshResponse,
  AuthRegisterResponse,
  Bankroll,
  BankrollStats,
  Bet,
  LeaderboardRow,
  Sport,
  WidgetPayload,
  Window,
} from '@nouveau/types';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  getRefreshToken?: () => string | null;
  includeCredentials?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  isAdultConfirmed: boolean;
  redirectBaseUrl?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshInput {
  refreshToken?: string;
}

export interface CreateBankrollInput {
  name: string;
  mode: 'SECURE_LOCKED' | 'FLEX_EDIT';
  sport: Sport;
  isPublic?: boolean;
}

export interface CreateBetInput {
  bankrollId: string;
  sport: Sport;
  stakeUnits: number;
  oddsDecimal: number;
  isLive: boolean;
  eventStartAt: string;
  legs?: Array<{ sportEventId: string; market: string; selection: string; oddsDecimal: number }>;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => string | null;
  private readonly getRefreshToken?: () => string | null;
  private readonly includeCredentials: boolean;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.getRefreshToken = options.getRefreshToken;
    this.includeCredentials = options.includeCredentials ?? false;
  }

  async register(input: RegisterInput): Promise<AuthRegisterResponse> {
    return this.request<AuthRegisterResponse>('POST', '/v1/auth/register', input, false);
  }

  async login(input: LoginInput): Promise<AuthLoginResponse> {
    return this.request<AuthLoginResponse>('POST', '/v1/auth/login', input, false);
  }

  async refresh(input?: RefreshInput): Promise<AuthRefreshResponse> {
    return this.request<AuthRefreshResponse>('POST', '/v1/auth/refresh', {
      refreshToken: input?.refreshToken ?? this.getRefreshToken?.() ?? undefined,
    }, false);
  }

  async logout(refreshToken?: string): Promise<{ success: true }> {
    return this.request<{ success: true }>('POST', '/v1/auth/logout', {
      refreshToken: refreshToken ?? this.getRefreshToken?.() ?? undefined,
    }, false);
  }

  async me(): Promise<AuthMe> {
    return this.request<AuthMe>('GET', '/v1/me');
  }

  async createBankroll(input: CreateBankrollInput): Promise<Bankroll> {
    return this.request<Bankroll>('POST', '/v1/bankrolls', input);
  }

  async listBankrolls(): Promise<Bankroll[]> {
    return this.request<Bankroll[]>('GET', '/v1/bankrolls');
  }

  async getBankroll(id: string): Promise<Bankroll> {
    return this.request<Bankroll>('GET', `/v1/bankrolls/${id}`);
  }

  async getBankrollStats(id: string, from: string, to: string, sport?: Sport): Promise<BankrollStats> {
    const query = new URLSearchParams({ from, to, ...(sport ? { sport } : {}) });
    return this.request<BankrollStats>('GET', `/v1/bankrolls/${id}/stats?${query.toString()}`);
  }

  async createBet(input: CreateBetInput): Promise<Bet> {
    return this.request<Bet>('POST', '/v1/bets', input);
  }

  async getLeaderboard(window: Window, sport?: Sport, from?: string, to?: string): Promise<LeaderboardRow[]> {
    const query = new URLSearchParams({
      window,
      ...(sport ? { sport } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    return this.request<LeaderboardRow[]>('GET', `/v1/public/leaderboard?${query.toString()}`, undefined, false);
  }

  async getWidget(widgetKey: string, window: Window, sport?: Sport): Promise<WidgetPayload> {
    const query = new URLSearchParams({ window, ...(sport ? { sport } : {}) });
    return this.request<WidgetPayload>('GET', `/v1/public/widgets/${widgetKey}/data?${query.toString()}`, undefined, false);
  }

  private async request<T>(method: string, path: string, body?: unknown, withAuth = true): Promise<T> {
    const token = withAuth ? this.getAccessToken?.() : null;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: this.includeCredentials ? 'include' : 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(text || 'Request failed', response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
