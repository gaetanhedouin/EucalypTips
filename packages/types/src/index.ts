export type BankrollMode = 'SECURE_LOCKED' | 'FLEX_EDIT';
export type BetStatus = 'PENDING' | 'WIN' | 'LOSS';
export type Sport = 'FOOTBALL' | 'BASKETBALL' | 'TENNIS';

export type Window = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'ALL_TIME' | 'CUSTOM';

export type SubscriptionPlanCode =
  | 'football_monthly'
  | 'basket_monthly'
  | 'tennis_monthly'
  | 'all_sports_monthly';

export interface User {
  id: string;
  email: string;
  name: string;
  isAdultConfirmed: boolean;
  createdAt: string;
}

export interface TrainerProfile {
  userId: string;
  slug: string;
  displayName: string;
  approvedAt: string | null;
}

export interface Bankroll {
  id: string;
  userId: string;
  name: string;
  mode: BankrollMode;
  isPublic: boolean;
  sport: Sport;
  currency: 'EUR';
  timezone: 'Europe/Paris';
  createdAt: string;
  updatedAt: string;
}

export interface BetLeg {
  id: string;
  betId: string;
  sportEventId: string;
  market: string;
  selection: string;
  oddsDecimal: number;
}

export interface Bet {
  id: string;
  bankrollId: string;
  userId: string;
  sport: Sport;
  bookmaker?: string;
  stakeUnits: number;
  oddsDecimal: number;
  isLive: boolean;
  eventStartAt: string;
  status: BetStatus;
  profitUnits: number;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  legs: BetLeg[];
}

export interface BankrollStats {
  bankrollId: string;
  from: string;
  to: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  stakedUnits: number;
  profitUnits: number;
  roi: number;
  yield: number;
  drawdown: number;
}

export interface LeaderboardRow {
  sourceSlug: string;
  sourceName: string;
  sport: Sport;
  window: Window;
  totalBets: number;
  winRate: number;
  roi: number;
  yield: number;
  profitUnits: number;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planCode: SubscriptionPlanCode;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  trialEndsAt: string | null;
  currentPeriodEnd: string;
}

export interface WidgetPayload {
  widgetKey: string;
  rows: LeaderboardRow[];
  generatedAt: string;
}

export interface AuthSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type AuthTokens = AuthSessionTokens;

export interface AuthRegisterResponse {
  success: true;
  pendingVerification: true;
  verificationUrlPreview?: string;
}

export interface AuthMe {
  id: string;
  email: string;
  name: string;
  isAdultConfirmed: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthLoginResponse {
  success: true;
  accessToken: string;
  refreshToken: string;
  user: AuthMe;
}

export interface AuthRefreshResponse {
  success: true;
  accessToken: string;
  refreshToken: string;
}

export interface AuthLogoutResponse {
  success: true;
}

export interface RealtimeEvent<TPayload = unknown> {
  type:
    | 'bet.created'
    | 'bet.updated'
    | 'bet.locked'
    | 'bet.settled'
    | 'stats.updated'
    | 'leaderboard.updated';
  payload: TPayload;
  emittedAt: string;
}


