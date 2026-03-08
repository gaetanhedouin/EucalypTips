'use client';

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import type { Bankroll, BankrollStats, Bet, BetStatus, Sport } from '@nouveau/types';

type AuthMode = 'login' | 'register' | 'forgot';
type DrawerMode = 'closed' | 'create' | 'detail' | 'edit';
type MenuId =
  | 'bankrolls'
  | 'favorite'
  | 'analyseur'
  | 'optimiseur'
  | 'bilans'
  | 'configurations'
  | 'mes-suivis'
  | 'activites'
  | 'montantes'
  | 'calculateurs';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
}

interface MenuItem {
  id: MenuId;
  label: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface HistoryDay {
  key: string;
  label: string;
  bets: Bet[];
  profit: number;
}

interface HistoryWeek {
  key: string;
  label: string;
  days: HistoryDay[];
  profit: number;
}

interface HistoryMonth {
  key: string;
  label: string;
  weeks: HistoryWeek[];
  profit: number;
}

interface SettlementOption {
  id: string;
  label: string;
  mappedStatus?: BetStatus;
  supported: boolean;
}

type BankrollDrawerMode = 'closed' | 'create' | 'edit';
type BankrollVisibility = 'PUBLIC' | 'PRIVATE' | 'STRICT';
type OddsDisplay = 'DECIMAL' | 'AMERICAN' | 'FRACTIONAL';

interface BankrollAllocation {
  id: string;
  bookmaker: string;
  capital: string;
}

interface PersistedBankrollAllocation {
  bookmaker: string;
  capital: string;
}

interface BankrollUiPreferences {
  initialCapital: string;
  currency: 'EUR' | 'USD';
  splitCapital: boolean;
  allocations: PersistedBankrollAllocation[];
  oddsDisplay: OddsDisplay;
  visibility: BankrollVisibility;
  archived: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const FAVORITE_KEY = 'eucanalyptips.favoriteBankrollId';
const BANKROLL_ORDER_KEY = 'eucanalyptips.bankrollOrder';
const BANKROLL_PREFS_KEY = 'eucanalyptips.bankrollPrefs';
const ACCESS_TOKEN_KEY = 'eucanalyptips.auth.accessToken';
const REFRESH_TOKEN_KEY = 'eucanalyptips.auth.refreshToken';
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? '';

const GROUPS: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: 'Gestion',
    items: [
      { id: 'bankrolls', label: 'Bankrolls' },
      { id: 'favorite', label: 'Telle bankroll' },
      { id: 'analyseur', label: 'Analyseur' },
      { id: 'optimiseur', label: 'Optimiseur' },
      { id: 'bilans', label: 'Bilans' },
      { id: 'configurations', label: 'Configurations' },
    ],
  },
  {
    title: 'Communaute',
    items: [
      { id: 'mes-suivis', label: 'Mes suivis' },
      { id: 'activites', label: 'Activites' },
    ],
  },
  {
    title: 'Outils',
    items: [
      { id: 'montantes', label: 'Montantes' },
      { id: 'calculateurs', label: 'Calculateurs' },
    ],
  },
];

const SETTLEMENT_OPTIONS: SettlementOption[] = [
  { id: 'PENDING', label: 'En attente', mappedStatus: 'PENDING', supported: true },
  { id: 'WIN', label: 'Gagne', mappedStatus: 'WIN', supported: true },
  { id: 'LOSS', label: 'Perdu', mappedStatus: 'LOSS', supported: true },
  { id: 'REFUND', label: 'Rembourse', supported: false },
  { id: 'HALF_WIN', label: 'Moitie gagne', supported: false },
  { id: 'HALF_LOSS', label: 'Moitie perdu', supported: false },
  { id: 'CASHOUT', label: 'Cashout', supported: false },
  { id: 'CANCELED', label: 'Annule', supported: false },
];

const BOOKMAKER_OPTIONS = ['Winamax', 'Betclic', 'Unibet', 'Bwin', 'ParionsSport'];

function formatSignedEuro(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)}€`;
}

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function statusLabel(status: BetStatus): string {
  if (status === 'WIN') {
    return 'Gagne';
  }
  if (status === 'LOSS') {
    return 'Perdu';
  }
  return 'En attente';
}

function statusBadgeClass(status: BetStatus): string {
  if (status === 'WIN') {
    return 'border-[#2dd4bf]/40 bg-[#0f3f3a] text-[#7de8d3]';
  }
  if (status === 'LOSS') {
    return 'border-[#ff5d7a]/50 bg-[#45182a] text-[#ff8ea3]';
  }
  return 'border-white/20 bg-[#17233f] text-[#c5d2d9]';
}

function normalizeBookmakerLabel(bookmaker: string | null | undefined): string {
  return (bookmaker ?? '').trim();
}

function bookmakerBrandKey(bookmaker: string | null | undefined): 'winamax' | 'betclic' | 'unibet' | 'bwin' | 'parionssport' | null {
  const normalized = normalizeBookmakerLabel(bookmaker).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('winamax')) {
    return 'winamax';
  }
  if (normalized.includes('betclic')) {
    return 'betclic';
  }
  if (normalized.includes('unibet')) {
    return 'unibet';
  }
  if (normalized.includes('bwin')) {
    return 'bwin';
  }
  if (normalized.includes('parions') || normalized.includes('france')) {
    return 'parionssport';
  }
  return null;
}

function bookmakerLogoPath(bookmaker: string | null | undefined): string | null {
  const brand = bookmakerBrandKey(bookmaker);
  if (!brand) {
    return null;
  }
  return `/bookmakers/${brand}.svg`;
}

function bookmakerBadgeClass(bookmaker: string | null | undefined): string {
  const normalized = normalizeBookmakerLabel(bookmaker).toLowerCase();
  if (normalized.includes('winamax')) {
    return 'border-[#ff4f5f]/60 bg-[#4b1119] text-[#ffd8dc]';
  }
  if (normalized.includes('betclic')) {
    return 'border-[#ff6f85]/60 bg-[#5a1a26] text-[#ffe1e7]';
  }
  if (normalized.includes('unibet')) {
    return 'border-[#4bcf93]/50 bg-[#0f3f2d] text-[#d5ffed]';
  }
  if (normalized.includes('bwin')) {
    return 'border-[#ffd166]/45 bg-[#3d3012] text-[#fff1c4]';
  }
  return 'border-white/20 bg-[#162441] text-[#d8e4ff]';
}

function bookmakerSeriesPalette(bookmaker: string): {
  strokeColor: string;
  buttonClassActive: string;
} {
  const brand = bookmakerBrandKey(bookmaker);
  if (brand === 'winamax') {
    return {
      strokeColor: '#ff3346',
      buttonClassActive: 'border-transparent bg-[#ff3346] text-[#160509]',
    };
  }
  if (brand === 'betclic') {
    return {
      strokeColor: '#ff1f3a',
      buttonClassActive: 'border-transparent bg-[#ff1f3a] text-[#19050b]',
    };
  }
  if (brand === 'unibet') {
    return {
      strokeColor: '#00f51a',
      buttonClassActive: 'border-transparent bg-[#00f51a] text-[#052008]',
    };
  }
  if (brand === 'bwin') {
    return {
      strokeColor: '#ffd166',
      buttonClassActive: 'border-transparent bg-[#ffd166] text-[#2a220e]',
    };
  }
  if (brand === 'parionssport') {
    return {
      strokeColor: '#6fa6ff',
      buttonClassActive: 'border-transparent bg-[#6fa6ff] text-[#06162f]',
    };
  }

  return {
    strokeColor: '#c5d2d9',
    buttonClassActive: 'border-transparent bg-[#c5d2d9] text-[#0b1326]',
  };
}

function parsePositiveNumber(raw: string | null | undefined, fallback: number): number {
  const source = (raw ?? '').trim();
  if (!source) {
    return fallback;
  }

  const parsed = Number(source.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

function formatEuroCompact(value: number): string {
  return `${value.toFixed(2)}€`;
}

function formatCurveValue(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.005) {
    return `${Math.round(rounded)}€`;
  }
  if (Math.abs(rounded * 10 - Math.round(rounded * 10)) < 0.01) {
    return `${rounded.toFixed(1)}€`;
  }
  return `${rounded.toFixed(2)}€`;
}

function getRoundedAxisTicks(min: number, max: number, targetTickCount = 4): { min: number; max: number; ticks: number[] } {
  const fallback = { min: 0, max: 1, ticks: [1, 0.66, 0.33, 0] };
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return fallback;
  }

  if (Math.abs(max - min) < 1e-9) {
    const center = min;
    const span = Math.max(10, Math.abs(center) * 0.1);
    const niceMin = Math.floor((center - span) / 10) * 10;
    const niceMax = Math.ceil((center + span) / 10) * 10;
    const step = Math.max(1, (niceMax - niceMin) / Math.max(1, targetTickCount - 1));
    const ticks = Array.from({ length: targetTickCount }, (_, index) => niceMax - step * index);
    return { min: niceMin, max: niceMax, ticks };
  }

  const rawRange = max - min;
  const roughStep = rawRange / Math.max(1, targetTickCount - 1);
  const power = Math.pow(10, Math.floor(Math.log10(Math.abs(roughStep))));
  const normalized = roughStep / power;

  let stepFactor = 1;
  if (normalized <= 1) {
    stepFactor = 1;
  } else if (normalized <= 2) {
    stepFactor = 2;
  } else if (normalized <= 5) {
    stepFactor = 5;
  } else {
    stepFactor = 10;
  }

  const step = stepFactor * power;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticksAscending: number[] = [];
  for (let value = niceMin; value <= niceMax + step * 0.5; value += step) {
    ticksAscending.push(Math.round(value * 1000) / 1000);
  }

  return {
    min: niceMin,
    max: niceMax,
    ticks: [...ticksAscending].reverse(),
  };
}

function createAllocation(bookmaker = 'Winamax', capital = ''): BankrollAllocation {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    bookmaker,
    capital,
  };
}

function emptyBankrollPreferences(): BankrollUiPreferences {
  return {
    initialCapital: '300',
    currency: 'EUR',
    splitCapital: false,
    allocations: [],
    oddsDisplay: 'DECIMAL',
    visibility: 'PRIVATE',
    archived: false,
  };
}

function resolveVisibility(row: Bankroll): BankrollVisibility {
  if (row.mode === 'SECURE_LOCKED' && row.isPublic) {
    return 'STRICT';
  }
  if (row.isPublic) {
    return 'PUBLIC';
  }
  return 'PRIVATE';
}

function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function EucAnalypTipsPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuId>('bankrolls');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [followTab, setFollowTab] = useState<'tipsters' | 'bankrolls'>('tipsters');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [bankrolls, setBankrolls] = useState<Bankroll[]>([]);
  const [favoriteBankrollId, setFavoriteBankrollId] = useState<string | null>(null);
  const [bankrollOrder, setBankrollOrder] = useState<string[]>([]);
  const [bankrollPreferences, setBankrollPreferences] = useState<Record<string, BankrollUiPreferences>>({});
  const [bankrollCardStats, setBankrollCardStats] = useState<Record<string, { roi: number; profit: number }>>({});
  const [bankrollOrganizeMode, setBankrollOrganizeMode] = useState(false);
  const [dragBankrollId, setDragBankrollId] = useState<string | null>(null);
  const [bankrollDrawerMode, setBankrollDrawerMode] = useState<BankrollDrawerMode>('closed');
  const [editingBankrollId, setEditingBankrollId] = useState<string | null>(null);
  const [bankrollSaving, setBankrollSaving] = useState(false);
  const [bankrollFormName, setBankrollFormName] = useState('');
  const [bankrollFormInitialCapital, setBankrollFormInitialCapital] = useState('300');
  const [bankrollFormCurrency, setBankrollFormCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [bankrollFormSplitCapital, setBankrollFormSplitCapital] = useState(false);
  const [bankrollFormAllocations, setBankrollFormAllocations] = useState<BankrollAllocation[]>([]);
  const [bankrollFormOddsDisplay, setBankrollFormOddsDisplay] = useState<OddsDisplay>('DECIMAL');
  const [bankrollFormVisibility, setBankrollFormVisibility] = useState<BankrollVisibility>('PRIVATE');

  const [montanteStart, setMontanteStart] = useState('100');
  const [montanteSteps, setMontanteSteps] = useState('5');
  const [montanteRate, setMontanteRate] = useState('1.80');

  const [calcOdds, setCalcOdds] = useState('1.90');
  const [calcStake, setCalcStake] = useState('10');

  const [selectedBankrollId, setSelectedBankrollId] = useState('');
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<BankrollStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [betSport, setBetSport] = useState<Sport>('FOOTBALL');
  const [betCompetition, setBetCompetition] = useState('');
  const [betTitle, setBetTitle] = useState('');
  const [betOdds, setBetOdds] = useState('1.80');
  const [betStake, setBetStake] = useState('10');
  const [betEventStart, setBetEventStart] = useState('');
  const [betIsLive, setBetIsLive] = useState(false);
  const [betStatusDraft, setBetStatusDraft] = useState<BetStatus>('PENDING');
  const [betBookmaker, setBetBookmaker] = useState('');
  const [betPercentCapital, setBetPercentCapital] = useState('');
  const [betComment, setBetComment] = useState('');
  const [betFormat, setBetFormat] = useState<'SIMPLE' | 'BACK' | 'LAY'>('SIMPLE');
  const [showAdvancedBetOptions, setShowAdvancedBetOptions] = useState(false);
  const [betOptionCommission, setBetOptionCommission] = useState(false);
  const [betOptionBonus, setBetOptionBonus] = useState(false);
  const [betOptionFree, setBetOptionFree] = useState(false);
  const [betOptionCashout, setBetOptionCashout] = useState(false);
  const [betOptionEachWay, setBetOptionEachWay] = useState(false);
  const [betOptionHidden, setBetOptionHidden] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('closed');
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  const [statusModalBetId, setStatusModalBetId] = useState<string | null>(null);
  const [savingBet, setSavingBet] = useState(false);

  const [magicInput, setMagicInput] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicFeedback, setMagicFeedback] = useState('');
  const [magicError, setMagicError] = useState(false);

  const [coachLoading, setCoachLoading] = useState(false);
  const [coachOutput, setCoachOutput] = useState('');
  const [coachFeedback, setCoachFeedback] = useState('');
  const [chartSeriesVisibility, setChartSeriesVisibility] = useState<Record<string, boolean>>({ global: true });
  const [chartHover, setChartHover] = useState<{
    seriesKey: string;
    label: string;
    color: string;
    x: number;
    y: number;
    value: number;
  } | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedFavorite = window.localStorage.getItem(FAVORITE_KEY);
    if (savedFavorite) {
      setFavoriteBankrollId(savedFavorite);
    }

    const savedOrder = window.localStorage.getItem(BANKROLL_ORDER_KEY);
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed)) {
          setBankrollOrder(parsed.filter((value): value is string => typeof value === 'string'));
        }
      } catch {
        // ignore corrupted local value
      }
    }

    const savedPreferences = window.localStorage.getItem(BANKROLL_PREFS_KEY);
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences) as Record<string, BankrollUiPreferences>;
        if (parsed && typeof parsed === 'object') {
          setBankrollPreferences(parsed);
        }
      } catch {
        // ignore corrupted local value
      }
    }

    const localIso = new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setBetEventStart(localIso);

    void hydrateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedBankrolls = useMemo(() => {
    if (bankrolls.length === 0) {
      return [];
    }

    const rowById = new Map(bankrolls.map((row) => [row.id, row]));
    const ordered = bankrollOrder.map((id) => rowById.get(id)).filter((row): row is Bankroll => Boolean(row));
    const missing = bankrolls.filter((row) => !bankrollOrder.includes(row.id));
    return [...ordered, ...missing];
  }, [bankrolls, bankrollOrder]);

  const archivedBankrolls = useMemo(
    () => orderedBankrolls.filter((row) => bankrollPreferences[row.id]?.archived),
    [orderedBankrolls, bankrollPreferences],
  );

  const visibleBankrolls = useMemo(
    () => orderedBankrolls.filter((row) => !bankrollPreferences[row.id]?.archived),
    [orderedBankrolls, bankrollPreferences],
  );

  const favoriteBankroll = useMemo(
    () => visibleBankrolls[0] ?? orderedBankrolls[0] ?? null,
    [orderedBankrolls, visibleBankrolls],
  );

  useEffect(() => {
    setBankrollOrder((prev) => {
      const valid = prev.filter((id) => bankrolls.some((row) => row.id === id));
      const missing = bankrolls.map((row) => row.id).filter((id) => !valid.includes(id));
      const next = [...valid, ...missing];
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [bankrolls]);

  useEffect(() => {
    window.localStorage.setItem(BANKROLL_ORDER_KEY, JSON.stringify(bankrollOrder));
  }, [bankrollOrder]);

  useEffect(() => {
    window.localStorage.setItem(BANKROLL_PREFS_KEY, JSON.stringify(bankrollPreferences));
  }, [bankrollPreferences]);

  useEffect(() => {
    const nextFavoriteId = favoriteBankroll?.id ?? null;
    if (favoriteBankrollId === nextFavoriteId) {
      return;
    }
    setFavoriteBankrollId(nextFavoriteId);
    if (nextFavoriteId) {
      window.localStorage.setItem(FAVORITE_KEY, nextFavoriteId);
    } else {
      window.localStorage.removeItem(FAVORITE_KEY);
    }
  }, [favoriteBankroll?.id, favoriteBankrollId]);

  useEffect(() => {
    if (orderedBankrolls.length === 0) {
      setSelectedBankrollId('');
      setBets([]);
      setStats(null);
      return;
    }

    setSelectedBankrollId((prev) => {
      if (prev && visibleBankrolls.some((row) => row.id === prev)) {
        return prev;
      }
      if (favoriteBankrollId && visibleBankrolls.some((row) => row.id === favoriteBankrollId)) {
        return favoriteBankrollId;
      }
      return visibleBankrolls[0]?.id ?? orderedBankrolls[0]?.id ?? '';
    });
  }, [favoriteBankrollId, orderedBankrolls, visibleBankrolls]);

  useEffect(() => {
    if (!user || !selectedBankrollId) {
      return;
    }
    void loadAnalytics(selectedBankrollId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankrollId, user?.id]);

  useEffect(() => {
    if (!user || orderedBankrolls.length === 0) {
      setBankrollCardStats({});
      return;
    }

    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
    const statsQuery = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    async function loadCards(): Promise<void> {
      const entries = await Promise.all(
        orderedBankrolls.map(async (row) => {
          try {
            const response = await authedFetch(`/v1/bankrolls/${row.id}/stats?${statsQuery.toString()}`);
            if (!response.ok) {
              return [row.id, { roi: 0, profit: 0 }] as const;
            }
            const payload = (await response.json()) as BankrollStats;
            return [row.id, { roi: payload.roi, profit: payload.profitUnits }] as const;
          } catch {
            return [row.id, { roi: 0, profit: 0 }] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setBankrollCardStats(Object.fromEntries(entries));
    }

    void loadCards();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedBankrolls, user?.id]);

  useEffect(() => {
    if (activeMenu !== 'favorite') {
      setDrawerMode('closed');
      setActiveBetId(null);
      setStatusModalBetId(null);
    }
    if (activeMenu !== 'bankrolls') {
      setBankrollDrawerMode('closed');
      setEditingBankrollId(null);
      setBankrollOrganizeMode(false);
      setDragBankrollId(null);
    }
  }, [activeMenu]);

  const menuGroups = useMemo(() => {
    return GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.id === 'favorite'
          ? {
              ...item,
              label: favoriteBankroll ? favoriteBankroll.name : 'Telle bankroll',
            }
          : item,
      ),
    }));
  }, [favoriteBankroll]);

  const montanteResult = useMemo(() => {
    const start = Number(montanteStart);
    const steps = Number(montanteSteps);
    const rate = Number(montanteRate);
    if (!Number.isFinite(start) || !Number.isFinite(steps) || !Number.isFinite(rate) || start <= 0 || steps <= 0 || rate <= 1) {
      return null;
    }

    let bankroll = start;
    for (let i = 0; i < steps; i += 1) {
      bankroll *= rate;
    }
    return bankroll;
  }, [montanteStart, montanteSteps, montanteRate]);

  const impliedProbability = useMemo(() => {
    const odds = Number(calcOdds);
    if (!Number.isFinite(odds) || odds <= 1) {
      return null;
    }
    return (1 / odds) * 100;
  }, [calcOdds]);

  const grossReturn = useMemo(() => {
    const odds = Number(calcOdds);
    const stake = Number(calcStake);
    if (!Number.isFinite(odds) || !Number.isFinite(stake) || odds <= 1 || stake <= 0) {
      return null;
    }
    return stake * odds;
  }, [calcOdds, calcStake]);

  const selectedBankroll = useMemo(
    () => bankrolls.find((row) => row.id === selectedBankrollId) ?? null,
    [bankrolls, selectedBankrollId],
  );
  const activeBet = useMemo(
    () => bets.find((row) => row.id === activeBetId) ?? null,
    [bets, activeBetId],
  );
  const statusModalBet = useMemo(
    () => bets.find((row) => row.id === statusModalBetId) ?? null,
    [bets, statusModalBetId],
  );

  const recentBets = useMemo(() => {
    return [...bets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [bets]);

  const compareBetsForPassage = (left: Bet, right: Bet): number => {
    const leftPassage = new Date(left.eventStartAt).getTime();
    const rightPassage = new Date(right.eventStartAt).getTime();
    if (leftPassage !== rightPassage) {
      return leftPassage - rightPassage;
    }

    const rank = (status: BetStatus): number => {
      if (status === 'WIN') {
        return 0;
      }
      if (status === 'LOSS') {
        return 1;
      }
      return 2;
    };

    const statusDiff = rank(left.status) - rank(right.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const profitDiff = right.profitUnits - left.profitUnits;
    if (profitDiff !== 0) {
      return profitDiff;
    }

    const leftCreated = new Date(left.createdAt).getTime();
    const rightCreated = new Date(right.createdAt).getTime();
    if (leftCreated !== rightCreated) {
      return leftCreated - rightCreated;
    }

    return left.id.localeCompare(right.id);
  };

  const compareBetsForJournal = (left: Bet, right: Bet): number => {
    const leftPassage = new Date(left.eventStartAt).getTime();
    const rightPassage = new Date(right.eventStartAt).getTime();
    if (leftPassage !== rightPassage) {
      return rightPassage - leftPassage;
    }

    const rank = (status: BetStatus): number => {
      if (status === 'WIN') {
        return 0;
      }
      if (status === 'LOSS') {
        return 1;
      }
      return 2;
    };

    const statusDiff = rank(left.status) - rank(right.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const profitDiff = right.profitUnits - left.profitUnits;
    if (profitDiff !== 0) {
      return profitDiff;
    }

    const leftCreated = new Date(left.createdAt).getTime();
    const rightCreated = new Date(right.createdAt).getTime();
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    return left.id.localeCompare(right.id);
  };

  const dominantSport = useMemo(() => {
    const counters: Record<Sport, number> = {
      FOOTBALL: 0,
      BASKETBALL: 0,
      TENNIS: 0,
    };

    for (const row of bets) {
      counters[row.sport] += 1;
    }

    return (Object.entries(counters).sort((a, b) => b[1] - a[1])[0]?.[0] as Sport | undefined) ?? 'FOOTBALL';
  }, [bets]);

  const equityChart = useMemo(() => {
    const width = 1200;
    const height = 360;
    const plotLeft = 74;
    const plotRight = width - 88;
    const plotTop = 16;
    const plotBottom = height - 22;
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotHeight = Math.max(1, plotBottom - plotTop);

    const selectedPrefs = selectedBankrollId ? bankrollPreferences[selectedBankrollId] : undefined;
    const baseCapital = parsePositiveNumber(selectedPrefs?.initialCapital, 300);

    const ordered = [...bets].sort(compareBetsForPassage);
    const globalValues = ordered.length
      ? ordered.reduce<number[]>((acc, row) => {
          const previous = acc[acc.length - 1] ?? baseCapital;
          acc.push(Math.round((previous + row.profitUnits) * 100) / 100);
          return acc;
        }, [baseCapital])
      : [baseCapital, baseCapital + 2, baseCapital + 5, baseCapital + 8, baseCapital + 12, baseCapital + 9, baseCapital + 13];

    const splitCapitalEnabled = Boolean(selectedPrefs?.splitCapital || (selectedPrefs?.allocations?.length ?? 0) > 0);
    const allocations = selectedPrefs?.allocations ?? [];
    const allocationBookmakers = allocations
      .map((row) => normalizeBookmakerLabel(row.bookmaker))
      .filter((row): row is string => row.length > 0);
    const betBookmakers = ordered
      .map((row) => normalizeBookmakerLabel(row.bookmaker))
      .filter((row): row is string => row.length > 0);
    const bookmakerKeys = splitCapitalEnabled
      ? Array.from(new Set([...allocationBookmakers, ...betBookmakers]))
      : [];

    const allocationCapitalByBookmaker = new Map<string, number>();
    for (const allocation of allocations) {
      const bookmaker = normalizeBookmakerLabel(allocation.bookmaker);
      if (!bookmaker) {
        continue;
      }
      allocationCapitalByBookmaker.set(bookmaker, parsePositiveNumber(allocation.capital, 0));
    }

    const bookmakerSeriesValues = new Map<string, number[]>();
    const bookmakerStartByKey = new Map<string, number>();
    const defaultAllocationCapital = bookmakerKeys.length > 0 ? baseCapital / bookmakerKeys.length : 0;

    for (const bookmaker of bookmakerKeys) {
      const configuredCapital = allocationCapitalByBookmaker.get(bookmaker) ?? 0;
      const startValue = configuredCapital > 0 ? configuredCapital : defaultAllocationCapital;
      bookmakerStartByKey.set(bookmaker, startValue);

      const bookmakerRows = ordered.filter((row) => normalizeBookmakerLabel(row.bookmaker) === bookmaker);
      const values = bookmakerRows.length
        ? bookmakerRows.reduce<number[]>((acc, row) => {
            const previous = acc[acc.length - 1] ?? startValue;
            acc.push(Math.round((previous + row.profitUnits) * 100) / 100);
            return acc;
          }, [startValue])
        : [startValue];

      bookmakerSeriesValues.set(bookmaker, values);
    }

    const bookmakerReferenceBase = bookmakerKeys.length > 0
      ? bookmakerKeys
          .map((bookmaker) => bookmakerStartByKey.get(bookmaker) ?? 0)
          .find((value) => value > 0) ?? defaultAllocationCapital
      : null;

    const series = [
      {
        key: 'global',
        label: 'GLOBAL',
        strokeColor: '#42e0c8',
        buttonClassActive: 'border-transparent bg-[#42e0c8] text-[#041f1a]',
        areaFillColor: 'rgba(66, 224, 200, 0.24)',
        baseValue: baseCapital,
        values: globalValues,
      },
      ...bookmakerKeys.map((bookmaker) => {
        const palette = bookmakerSeriesPalette(bookmaker);
        const startValue = bookmakerStartByKey.get(bookmaker) ?? defaultAllocationCapital;
        return {
          key: `bookmaker:${bookmaker.toLowerCase()}`,
          label: bookmaker.toUpperCase(),
          strokeColor: palette.strokeColor,
          buttonClassActive: palette.buttonClassActive,
          areaFillColor: `${palette.strokeColor}33`,
          baseValue: startValue,
          values: bookmakerSeriesValues.get(bookmaker) ?? [startValue],
        };
      }),
    ].map((row) => {
      const shift = baseCapital - row.baseValue;
      const shiftedValues = row.values.map((value) => value + shift);
      const currentValue = row.values[row.values.length - 1] ?? row.baseValue;
      const gain = currentValue - row.baseValue;
      return {
        ...row,
        shiftedValues,
        currentValue,
        gain,
      };
    });

    const globalSeries = series.find((row) => row.key === 'global');
    const globalCurrent = globalSeries?.currentValue ?? baseCapital;
    const progression = ((globalCurrent - baseCapital) / Math.max(1, baseCapital)) * 100;

    return {
      width,
      height,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
      series,
      current: globalCurrent,
      progression,
      splitCapitalEnabled,
      globalBase: baseCapital,
      bookmakerReferenceBase,
      showSecondaryAxis: splitCapitalEnabled && bookmakerReferenceBase !== null && bookmakerReferenceBase > 0,
    };
  }, [bankrollPreferences, bets, selectedBankrollId]);

  const visibleEquitySeries = useMemo(
    () => equityChart.series.filter((series) => chartSeriesVisibility[series.key] ?? true),
    [chartSeriesVisibility, equityChart.series],
  );

  const chartRender = useMemo(() => {
    const activeSeries = visibleEquitySeries.length > 0
      ? visibleEquitySeries
      : equityChart.series.filter((series) => series.key === 'global');

    const allValues = activeSeries.flatMap((series) => series.shiftedValues);
    const rawMin = allValues.length > 0 ? Math.min(...allValues) : equityChart.globalBase;
    const rawMax = allValues.length > 0 ? Math.max(...allValues) : equityChart.globalBase;
    const rawRange = Math.max(1, rawMax - rawMin);
    const padding = Math.max(4, rawRange * 0.12);
    const axisTicks = getRoundedAxisTicks(rawMin - padding, rawMax + padding, 4);
    const min = axisTicks.min;
    const max = axisTicks.max;
    const range = Math.max(1, max - min);

    const toY = (value: number): number =>
      equityChart.plotTop + ((max - value) / range) * equityChart.plotHeight;

    const withGeometry = activeSeries.map((series) => {
      const fallbackValue = series.shiftedValues[0] ?? equityChart.globalBase;
      const plottedValues = series.shiftedValues.length > 1
        ? series.shiftedValues
        : [fallbackValue, fallbackValue];

      const points = plottedValues.map((value, index) => {
        const x = equityChart.plotLeft + (index / Math.max(1, plottedValues.length - 1)) * equityChart.plotWidth;
        return { x, y: toY(value) };
      });

      const linePath = buildSmoothPath(points);
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1] ?? firstPoint;
      const areaPath =
        series.areaFillColor && firstPoint && lastPoint
          ? `${linePath} L ${lastPoint.x.toFixed(2)} ${equityChart.plotBottom.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${equityChart.plotBottom.toFixed(2)} Z`
          : '';

      const gradientId = `equity-grad-${series.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

      return {
        ...series,
        points,
        linePath,
        areaPath,
        lastPoint,
        gradientId,
      };
    });

    const globalSeries = withGeometry.find((series) => series.key === 'global');
    const otherSeries = withGeometry
      .filter((series) => series.key !== 'global')
      .sort((left, right) => right.gain - left.gain);
    const layeredSeries = globalSeries ? [globalSeries, ...otherSeries] : otherSeries;

    const yTicks = axisTicks.ticks.length > 0 ? axisTicks.ticks : [max, min];

    const labels = layeredSeries
      .map((series) => ({
        key: series.key,
        value: formatCurveValue(series.currentValue),
        color: series.strokeColor,
        y: series.lastPoint?.y ?? equityChart.plotTop,
      }))
      .sort((left, right) => left.y - right.y);

    const minGap = 16;
    const topLimit = equityChart.plotTop + 8;
    const bottomLimit = equityChart.plotBottom - 4;

    for (let index = 0; index < labels.length; index += 1) {
      labels[index].y = Math.max(topLimit, Math.min(bottomLimit, labels[index].y));
      if (index > 0 && labels[index].y - labels[index - 1].y < minGap) {
        labels[index].y = labels[index - 1].y + minGap;
      }
    }

    for (let index = labels.length - 2; index >= 0; index -= 1) {
      if (labels[index + 1].y > bottomLimit) {
        labels[index + 1].y = bottomLimit;
      }
      if (labels[index + 1].y - labels[index].y < minGap) {
        labels[index].y = labels[index + 1].y - minGap;
      }
      labels[index].y = Math.max(topLimit, labels[index].y);
    }

    const labelByKey = new Map(labels.map((label) => [label.key, label]));

    return {
      min,
      max,
      yTicks,
      layeredSeries,
      labelByKey,
    };
  }, [equityChart, visibleEquitySeries]);

  const showBookmakerSeriesSwitches = useMemo(
    () => equityChart.splitCapitalEnabled && equityChart.series.length > 1,
    [equityChart.series.length, equityChart.splitCapitalEnabled],
  );

  useEffect(() => {
    setChartSeriesVisibility((previous) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const series of equityChart.series) {
        next[series.key] = previous[series.key] ?? true;
        if (next[series.key] !== previous[series.key]) {
          changed = true;
        }
      }

      const previousKeys = Object.keys(previous);
      if (previousKeys.length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [equityChart.series]);

  useEffect(() => {
    setChartHover((previous) => {
      if (!previous) {
        return previous;
      }
      const stillVisible = visibleEquitySeries.some((series) => series.key === previous.seriesKey);
      return stillVisible ? previous : null;
    });
  }, [visibleEquitySeries]);

  const historyByMonth = useMemo<HistoryMonth[]>(() => {
    const ordered = [...bets].sort(compareBetsForJournal);
    const months = new Map<string, HistoryMonth>();

    for (const row of ordered) {
      const date = new Date(row.eventStartAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
      const weekNumber = getIsoWeek(date);
      const weekKey = `${monthKey}-W${String(weekNumber).padStart(2, '0')}`;
      const dayKey = date.toISOString().slice(0, 10);
      const dayLabel = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
      });

      if (!months.has(monthKey)) {
        months.set(monthKey, {
          key: monthKey,
          label: monthLabel,
          weeks: [],
          profit: 0,
        });
      }

      const month = months.get(monthKey);
      if (!month) {
        continue;
      }

      let week = month.weeks.find((item) => item.key === weekKey);
      if (!week) {
        week = {
          key: weekKey,
          label: `Semaine ${weekNumber}`,
          days: [],
          profit: 0,
        };
        month.weeks.push(week);
      }

      let day = week.days.find((item) => item.key === dayKey);
      if (!day) {
        day = {
          key: dayKey,
          label: dayLabel,
          bets: [],
          profit: 0,
        };
        week.days.push(day);
      }

      day.bets.push(row);
      day.profit += row.profitUnits;
      week.profit += row.profitUnits;
      month.profit += row.profitUnits;
    }

    for (const month of months.values()) {
      month.weeks.sort((left, right) => right.key.localeCompare(left.key));
      for (const week of month.weeks) {
        week.days.sort((left, right) => right.key.localeCompare(left.key));
      }
    }

    return [...months.values()].sort((left, right) => right.key.localeCompare(left.key));
  }, [bets]);

  useEffect(() => {
    if (historyByMonth.length === 0) {
      setCollapsedMonths((previous) => (Object.keys(previous).length === 0 ? previous : {}));
      setCollapsedWeeks((previous) => (Object.keys(previous).length === 0 ? previous : {}));
      return;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentWeekKey = `${currentMonthKey}-W${String(getIsoWeek(now)).padStart(2, '0')}`;

    setCollapsedMonths((previous) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const month of historyByMonth) {
        const value = month.key === currentMonthKey ? (previous[month.key] ?? false) : true;
        next[month.key] = value;
        if (previous[month.key] !== value) {
          changed = true;
        }
      }

      if (Object.keys(previous).length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : previous;
    });

    setCollapsedWeeks((previous) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const month of historyByMonth) {
        for (const week of month.weeks) {
          const isCurrentWeek = month.key === currentMonthKey && week.key === currentWeekKey;
          const value = isCurrentWeek ? (previous[week.key] ?? false) : true;
          next[week.key] = value;
          if (previous[week.key] !== value) {
            changed = true;
          }
        }
      }

      if (Object.keys(previous).length !== Object.keys(next).length) {
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [historyByMonth]);

  const statsBars = useMemo(() => {
    const roi = (stats?.roi ?? 0) * 100;
    const winRate = (stats?.winRate ?? 0) * 100;
    const roiWidth = Math.max(2, Math.min(100, Math.abs(roi)));
    const winRateWidth = Math.max(2, Math.min(100, Math.abs(winRate)));

    return [
      {
        label: 'ROI',
        value: `${roi.toFixed(2)}%`,
        width: roiWidth,
        positive: roi >= 0,
      },
      {
        label: 'Win Rate',
        value: `${winRate.toFixed(2)}%`,
        width: winRateWidth,
        positive: winRate >= 50,
      },
    ];
  }, [stats]);

  function getStoredAccessToken(): string | null {
    try {
      return window.localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function getStoredRefreshToken(): string | null {
    try {
      return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function setStoredTokens(accessToken: string, refreshToken: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  function clearStoredTokens(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async function refreshAccessToken(): Promise<boolean> {
    const refreshToken = getStoredRefreshToken();
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
      clearStoredTokens();
      return false;
    }

    const payload = (await response.json().catch(() => null)) as
      | { accessToken?: string; refreshToken?: string }
      | null;

    if (!payload?.accessToken || !payload?.refreshToken) {
      clearStoredTokens();
      return false;
    }

    setStoredTokens(payload.accessToken, payload.refreshToken);
    return true;
  }

  async function authedFetch(path: string, init?: RequestInit, canRetry = true): Promise<Response> {
    const headers = new Headers(init?.headers ?? {});
    const accessToken = getStoredAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });

    if (response.status === 401 && canRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return authedFetch(path, init, false);
      }
    }

    return response;
  }

  async function hydrateSession(): Promise<void> {
    try {
      if (!getStoredAccessToken() && getStoredRefreshToken()) {
        await refreshAccessToken();
      }

      const meResponse = await authedFetch('/v1/me');
      if (!meResponse.ok) {
        clearStoredTokens();
        setUser(null);
        setBankrolls([]);
        setSelectedBankrollId('');
        setBets([]);
        setStats(null);
        return;
      }

      const me = (await meResponse.json()) as SessionUser;
      setUser(me);

      const bankrollsResponse = await authedFetch('/v1/bankrolls');
      if (bankrollsResponse.ok) {
        const rows = (await bankrollsResponse.json()) as Bankroll[];
        setBankrolls(rows);
      }
    } catch {
      clearStoredTokens();
      setUser(null);
      setBankrolls([]);
      setSelectedBankrollId('');
      setBets([]);
      setStats(null);
    } finally {
      setSessionReady(true);
    }
  }

  async function clearSession() {
    const refreshToken = getStoredRefreshToken();
    await fetch(`${API_BASE_URL}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    clearStoredTokens();
    setUser(null);
    setBankrolls([]);
    setBankrollOrder([]);
    setBankrollCardStats({});
    setBankrollDrawerMode('closed');
    setEditingBankrollId(null);
    setBankrollOrganizeMode(false);
    setDragBankrollId(null);
    setSelectedBankrollId('');
    setBets([]);
    setStats(null);
    setBankrollPreferences({});
    window.localStorage.removeItem(FAVORITE_KEY);
    window.localStorage.removeItem(BANKROLL_ORDER_KEY);
    window.localStorage.removeItem(BANKROLL_PREFS_KEY);
    setSessionReady(true);
  }
  async function parseApiError(response: Response, fallback: string): Promise<string> {
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

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function extractGeminiUserText(payload: Record<string, unknown>): string {
    const contents = payload.contents;
    if (!Array.isArray(contents)) {
      return '';
    }

    const first = contents[0] as { parts?: Array<{ text?: string }> } | undefined;
    const text = first?.parts?.map((part) => part.text ?? '').join(' ').trim();
    return text ?? '';
  }

  function mockGeminiResponse(payload: Record<string, unknown>): GeminiResponse {
    const generationConfig = payload.generationConfig as { responseMimeType?: string } | undefined;
    const userText = extractGeminiUserText(payload);

    if (generationConfig?.responseMimeType === 'application/json') {
      const oddsMatch = userText.match(/(?:cote|odd?s?)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)/i);
      const stakeMatch = userText.match(/(?:mise|stake)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)/i);
      const sport =
        /tennis|atp|wta/i.test(userText) ? 'TENNIS' : /basket|nba|euroleague/i.test(userText) ? 'BASKETBALL' : 'FOOTBALL';

      const parsed = {
        sport,
        competition: userText.split(',')[0]?.trim() || 'Competition manuelle',
        intitule: userText.split(',')[1]?.trim() || 'Selection manuelle',
        cote: Number((oddsMatch?.[1] ?? '1.80').replace(',', '.')),
        mise: Number((stakeMatch?.[1] ?? '10').replace(',', '.')),
      };

      return {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(parsed) }],
            },
          },
        ],
      };
    }

    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '<ul><li><strong>Structure tes mises</strong> avec une unite fixe pour reduire la variance.</li><li><strong>Coupe les marches non rentables</strong> et concentre-toi sur les sports ou ton ROI est positif.</li><li><strong>Fixe un plafond de risque</strong> par jour et un stop-loss hebdo pour proteger la bankroll.</li></ul>',
              },
            ],
          },
        },
      ],
    };
  }

  async function fetchGemini(payload: Record<string, unknown>): Promise<GeminiResponse> {
    if (!apiKey || apiKey === 'mock-local') {
      return mockGeminiResponse(payload);
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const details = await response.text().catch(() => '');
          throw new Error(`Gemini HTTP ${response.status}${details ? `: ${details}` : ''}`);
        }

        return (await response.json()) as GeminiResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Gemini request failed');
        if (attempt < 4) {
          await sleep(300 * 2 ** attempt);
        }
      }
    }

    throw lastError ?? new Error('Gemini request failed');
  }

  function extractGeminiText(payload: GeminiResponse): string {
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) {
      throw new Error('Gemini n a retourne aucun contenu exploitable.');
    }
    return text;
  }

  function normalizeSport(value: string): Sport {
    const normalized = value.trim().toUpperCase();
    if (normalized.startsWith('BASK')) {
      return 'BASKETBALL';
    }
    if (normalized.startsWith('TENN')) {
      return 'TENNIS';
    }
    return 'FOOTBALL';
  }

  function stripCodeFence(value: string): string {
    return value.replace(/^```(?:json|html)?\s*/i, '').replace(/```$/i, '').trim();
  }

  function toLocalDateTimeInputValue(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    const withOffset = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return withOffset.toISOString().slice(0, 16);
  }

  function resetBetDraft(): void {
    const localIso = new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setBetSport('FOOTBALL');
    setBetCompetition('');
    setBetTitle('');
    setBetOdds('1.80');
    setBetStake('10');
    setBetEventStart(localIso);
    setBetIsLive(false);
    setBetStatusDraft('PENDING');
    setBetBookmaker('');
    setBetPercentCapital('');
    setBetComment('');
    setBetFormat('SIMPLE');
    setShowAdvancedBetOptions(false);
    setBetOptionCommission(false);
    setBetOptionBonus(false);
    setBetOptionFree(false);
    setBetOptionCashout(false);
    setBetOptionEachWay(false);
    setBetOptionHidden(false);
  }

  function hydrateBetDraft(row: Bet): void {
    setBetSport(row.sport);
    setBetCompetition(row.legs[0]?.market ?? '');
    setBetTitle(row.legs[0]?.selection ?? '');
    setBetOdds(row.oddsDecimal.toFixed(3));
    setBetStake(row.stakeUnits.toFixed(2));
    setBetEventStart(toLocalDateTimeInputValue(row.eventStartAt));
    setBetIsLive(row.isLive);
    setBetStatusDraft(row.status);
    setBetBookmaker(row.bookmaker ?? '');
    setBetPercentCapital('');
    setBetComment('');
    setBetFormat('SIMPLE');
    setShowAdvancedBetOptions(false);
  }

  function openCreateDrawer(): void {
    resetBetDraft();
    setActiveBetId(null);
    setStatusModalBetId(null);
    setDrawerMode('create');
  }

  function openDetailDrawer(betId: string): void {
    setActiveBetId(betId);
    setStatusModalBetId(null);
    setDrawerMode('detail');
  }

  function openEditDrawer(betId: string): void {
    const row = bets.find((item) => item.id === betId);
    if (!row) {
      return;
    }
    hydrateBetDraft(row);
    setActiveBetId(betId);
    setStatusModalBetId(null);
    setDrawerMode('edit');
  }

  function closeDrawer(): void {
    setDrawerMode('closed');
    setActiveBetId(null);
  }

  async function loadAnalytics(bankrollId: string): Promise<void> {
    setAnalyticsLoading(true);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
      const statsQuery = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const betsQuery = new URLSearchParams({
        bankrollId,
        from: from.toISOString(),
        to: to.toISOString(),
      });

      const [betsResponse, statsResponse] = await Promise.all([
        authedFetch(`/v1/bets?${betsQuery.toString()}`),
        authedFetch(`/v1/bankrolls/${bankrollId}/stats?${statsQuery.toString()}`),
      ]);

      if (betsResponse.ok) {
        const rows = (await betsResponse.json()) as Bet[];
        setBets(rows);
      } else {
        setBets([]);
      }

      if (statsResponse.ok) {
        const nextStats = (await statsResponse.json()) as BankrollStats;
        setStats(nextStats);
      } else {
        setStats(null);
      }
    } catch {
      setBets([]);
      setStats(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function onCreateBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBankrollId) {
      setMessage('Selectionne une bankroll pour enregistrer le pari.');
      return;
    }

    const odds = Number(betOdds.replace(',', '.'));
    const stake = Number(betStake.replace(',', '.'));
    if (!Number.isFinite(odds) || odds <= 1.01) {
      setMessage('La cote doit etre superieure a 1.01.');
      return;
    }
    if (!Number.isFinite(stake) || stake <= 0) {
      setMessage('La mise doit etre superieure a 0.');
      return;
    }

    const eventDate = betEventStart ? new Date(betEventStart) : new Date(Date.now() + 60 * 60 * 1000);
    if (Number.isNaN(eventDate.getTime())) {
      setMessage('Date de match invalide.');
      return;
    }

    const legKeyBase = `${betCompetition} ${betTitle}`.trim().replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const sportEventId = `${legKeyBase || 'manual'}-${Date.now()}`;

    setSavingBet(true);
    setMessage('');
    try {
      const response = await authedFetch('/v1/bets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankrollId: selectedBankrollId,
          sport: betSport,
          bookmaker: betBookmaker.trim(),
          stakeUnits: stake,
          oddsDecimal: odds,
          isLive: betIsLive,
          eventStartAt: eventDate.toISOString(),
          legs: [
            {
              sportEventId,
              market: betCompetition || 'Match',
              selection: betTitle || 'Selection manuelle',
              oddsDecimal: odds,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Creation du pari impossible.'));
      }

      const created = (await response.json()) as Bet;
      if (betStatusDraft !== 'PENDING') {
        const settleResponse = await authedFetch(`/v1/bets/${created.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: betStatusDraft,
          }),
        });

        if (!settleResponse.ok) {
          throw new Error(await parseApiError(settleResponse, 'Pari cree mais statut non applique.'));
        }
      }

      await loadAnalytics(selectedBankrollId);
      setActiveBetId(created.id);
      setDrawerMode('detail');
      resetBetDraft();
      setMessage('Pari enregistre.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur creation pari');
    } finally {
      setSavingBet(false);
    }
  }

  async function onUpdateBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBet) {
      setMessage('Aucun pari selectionne.');
      return;
    }

    const odds = Number(betOdds.replace(',', '.'));
    const stake = Number(betStake.replace(',', '.'));
    if (!Number.isFinite(odds) || odds <= 1.01) {
      setMessage('La cote doit etre superieure a 1.01.');
      return;
    }
    if (!Number.isFinite(stake) || stake <= 0) {
      setMessage('La mise doit etre superieure a 0.');
      return;
    }

    const eventDate = betEventStart ? new Date(betEventStart) : new Date(Date.now() + 60 * 60 * 1000);
    if (Number.isNaN(eventDate.getTime())) {
      setMessage('Date de match invalide.');
      return;
    }

    const legKeyBase = `${betCompetition} ${betTitle}`.trim().replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const sportEventId = activeBet.legs[0]?.sportEventId ?? `${legKeyBase || 'manual'}-${Date.now()}`;

    setSavingBet(true);
    setMessage('');
    try {
      const response = await authedFetch(`/v1/bets/${activeBet.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sport: betSport,
          bookmaker: betBookmaker.trim(),
          stakeUnits: stake,
          oddsDecimal: odds,
          isLive: betIsLive,
          eventStartAt: eventDate.toISOString(),
          status: betStatusDraft,
          legs: [
            {
              sportEventId,
              market: betCompetition || 'Match',
              selection: betTitle || 'Selection manuelle',
              oddsDecimal: odds,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Modification du pari impossible.'));
      }

      await loadAnalytics(selectedBankrollId);
      setDrawerMode('detail');
      setMessage('Pari modifie.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur modification pari');
    } finally {
      setSavingBet(false);
    }
  }

  async function onSetBetStatus(status: BetStatus): Promise<void> {
    if (!statusModalBet) {
      return;
    }

    setSavingBet(true);
    setMessage('');
    try {
      const response = await authedFetch(`/v1/bets/${statusModalBet.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Mise a jour du statut impossible.'));
      }

      await loadAnalytics(selectedBankrollId);
      setStatusModalBetId(null);
      setActiveBetId(statusModalBet.id);
      if (drawerMode === 'closed') {
        setDrawerMode('detail');
      }
      setMessage('Statut du pari mis a jour.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur mise a jour statut');
    } finally {
      setSavingBet(false);
    }
  }

  async function analyserPariMagique() {
    if (!magicInput.trim()) {
      setMagicError(true);
      setMagicFeedback('Decris ton pari pour lancer l extraction.');
      return;
    }

    setMagicLoading(true);
    setMagicError(false);
    setMagicFeedback('');

    try {
      const payload = {
        systemInstruction: {
          parts: [
            {
              text: 'Tu es un assistant de saisie de paris sportifs. Reponds uniquement avec un JSON valide qui respecte le schema fourni.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: magicInput }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              sport: { type: 'STRING' },
              competition: { type: 'STRING' },
              intitule: { type: 'STRING' },
              cote: { type: 'NUMBER' },
              mise: { type: 'NUMBER' },
            },
            required: ['sport', 'competition', 'intitule', 'cote', 'mise'],
          },
        },
      };

      const rawResponse = await fetchGemini(payload);
      const jsonText = stripCodeFence(extractGeminiText(rawResponse));
      const parsed = JSON.parse(jsonText) as {
        sport?: string;
        competition?: string;
        intitule?: string;
        cote?: number;
        mise?: number;
      };

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Reponse IA invalide.');
      }

      if (typeof parsed.sport === 'string') {
        setBetSport(normalizeSport(parsed.sport));
      }
      if (typeof parsed.competition === 'string') {
        setBetCompetition(parsed.competition.trim());
      }
      if (typeof parsed.intitule === 'string') {
        setBetTitle(parsed.intitule.trim());
      }
      if (typeof parsed.cote === 'number' && Number.isFinite(parsed.cote)) {
        setBetOdds(parsed.cote.toFixed(2));
      }
      if (typeof parsed.mise === 'number' && Number.isFinite(parsed.mise)) {
        setBetStake(parsed.mise.toFixed(2));
      }

      setMagicError(false);
      setMagicFeedback('Pari extrait et formulaire pre-rempli.');
    } catch (error) {
      setMagicError(true);
      setMagicFeedback(error instanceof Error ? error.message : 'Extraction impossible.');
    } finally {
      setMagicLoading(false);
    }
  }

  async function genererConseilsCoach() {
    setCoachLoading(true);
    setCoachFeedback('');
    setCoachOutput('<p>Analyse en cours...</p>');

    try {
      const prompt = [
        `Capital actuel: ${stats?.stakedUnits?.toFixed?.(2) ?? '1250'}€`,
        `Profit total: ${stats?.profitUnits?.toFixed?.(2) ?? '106.25'}€`,
        `ROI: ${(stats ? stats.roi * 100 : 8.5).toFixed(2)}%`,
        `Win rate: ${(stats ? stats.winRate * 100 : 57.2).toFixed(2)}%`,
        `Sport principal observe: ${dominantSport}`,
        'Contexte simulation: Football performant, Basket negatif, discipline de mise variable.',
        'Donne exactement 3 conseils actionnables pour optimiser la bankroll.',
        'Reponds en HTML pur uniquement avec <ul>, <li>, <strong>.',
      ].join('\n');

      const payload = {
        systemInstruction: {
          parts: [
            {
              text: 'Tu es un parieur professionnel et mathematicien expert en gestion des risques. Tes conseils sont concrets, prudents et orientes ROI long terme.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const rawResponse = await fetchGemini(payload);
      const html = stripCodeFence(extractGeminiText(rawResponse));
      if (!html) {
        throw new Error('Aucun conseil genere.');
      }

      setCoachOutput(html);
      setCoachFeedback('Conseils IA generes.');
    } catch (error) {
      setCoachOutput('');
      setCoachFeedback(error instanceof Error ? error.message : 'Generation des conseils impossible.');
    } finally {
      setCoachLoading(false);
    }
  }

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setPreviewUrl(null);

    try {
      if (mode === 'register') {
        const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name,
            isAdultConfirmed: true,
            redirectBaseUrl: window.location.origin,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Enregistrement echoue'));
        }

        const data = (await response.json()) as { verificationUrlPreview?: string };
        setMode('login');
        setMessage('Compte cree. Verifie ton email puis connecte-toi.');
        setPreviewUrl(data.verificationUrlPreview ?? null);
        return;
      }

      if (mode === 'forgot') {
        const response = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, redirectBaseUrl: window.location.origin }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Impossible de lancer la reinitialisation'));
        }

        const data = (await response.json()) as { resetUrlPreview?: string };
        setMessage('Si cet email existe, un lien de reinitialisation a ete envoye.');
        setPreviewUrl(data.resetUrlPreview ?? null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Connexion echouee'));
      }

      const payload = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
        user?: SessionUser;
      };

      if (!payload.accessToken || !payload.refreshToken) {
        throw new Error('Tokens de session manquants dans la reponse de connexion.');
      }

      setStoredTokens(payload.accessToken, payload.refreshToken);
      if (payload.user) {
        setUser(payload.user);
      }

      await hydrateSession();
      setMessage('Connexion reussie.');
      setPreviewUrl(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function onResendVerification() {
    if (!email) {
      setMessage('Renseigne ton email pour renvoyer la verification.');
      return;
    }

    setLoading(true);
    setMessage('');
    setPreviewUrl(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectBaseUrl: window.location.origin }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Impossible de renvoyer la verification'));
      }

      const data = (await response.json()) as { verificationUrlPreview?: string };
      setMessage('Si le compte existe et n est pas verifie, un nouvel email a ete envoye.');
      setPreviewUrl(data.verificationUrlPreview ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }
  function closeBankrollDrawer(): void {
    setBankrollDrawerMode('closed');
    setEditingBankrollId(null);
  }

  function setBankrollFormFromPreferences(name: string, base: BankrollUiPreferences): void {
    setBankrollFormName(name);
    setBankrollFormInitialCapital(base.initialCapital);
    setBankrollFormCurrency(base.currency);
    setBankrollFormSplitCapital(base.splitCapital);
    setBankrollFormAllocations(
      base.allocations.length > 0
        ? base.allocations.map((row) => createAllocation(row.bookmaker, row.capital))
        : [createAllocation('Winamax', '')],
    );
    setBankrollFormOddsDisplay(base.oddsDisplay);
    setBankrollFormVisibility(base.visibility);
  }

  function openCreateBankrollDrawer(): void {
    const defaults = emptyBankrollPreferences();
    setEditingBankrollId(null);
    setBankrollDrawerMode('create');
    setBankrollFormFromPreferences('', defaults);
  }

  function openEditBankrollDrawer(bankrollId: string): void {
    const row = bankrolls.find((item) => item.id === bankrollId);
    if (!row) {
      return;
    }
    const saved = bankrollPreferences[bankrollId];
    const base: BankrollUiPreferences = saved
      ? saved
      : {
          ...emptyBankrollPreferences(),
          visibility: resolveVisibility(row),
        };
    setEditingBankrollId(bankrollId);
    setBankrollDrawerMode('edit');
    setBankrollFormFromPreferences(row.name, base);
  }

  function asCreatePayload(visibility: BankrollVisibility): { mode: 'SECURE_LOCKED' | 'FLEX_EDIT'; isPublic: boolean } {
    if (visibility === 'PRIVATE') {
      return {
        mode: 'FLEX_EDIT',
        isPublic: false,
      };
    }
    return {
      mode: 'SECURE_LOCKED',
      isPublic: true,
    };
  }

  function upsertBankrollPreferences(bankrollId: string, archivedOverride?: boolean): void {
    setBankrollPreferences((prev) => {
      const previous = prev[bankrollId] ?? emptyBankrollPreferences();
      const next: BankrollUiPreferences = {
        initialCapital: bankrollFormInitialCapital || previous.initialCapital,
        currency: bankrollFormCurrency,
        splitCapital: bankrollFormSplitCapital,
        allocations: bankrollFormSplitCapital
          ? bankrollFormAllocations
              .map((row) => ({
                bookmaker: row.bookmaker.trim(),
                capital: row.capital.trim(),
              }))
              .filter((row) => row.bookmaker && row.capital)
          : [],
        oddsDisplay: bankrollFormOddsDisplay,
        visibility: bankrollFormVisibility,
        archived: archivedOverride ?? previous.archived,
      };
      return {
        ...prev,
        [bankrollId]: next,
      };
    });
  }

  async function onSubmitBankroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const trimmedName = bankrollFormName.trim();
    if (trimmedName.length < 2) {
      setMessage('Le nom de bankroll doit contenir au moins 2 caracteres.');
      return;
    }

    const payload = asCreatePayload(bankrollFormVisibility);
    setBankrollSaving(true);
    setMessage('');
    try {
      if (bankrollDrawerMode === 'create') {
        const response = await authedFetch('/v1/bankrolls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
            mode: payload.mode,
            isPublic: payload.isPublic,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Erreur creation bankroll'));
        }

        const created = (await response.json()) as Bankroll;
        setBankrolls((prev) => [...prev, created]);
        setBankrollOrder((prev) => [...prev.filter((id) => id !== created.id), created.id]);
        upsertBankrollPreferences(created.id, false);
        setSelectedBankrollId((prev) => prev || created.id);
        setMessage('Bankroll creee.');
      } else if (bankrollDrawerMode === 'edit' && editingBankrollId) {
        const response = await authedFetch(`/v1/bankrolls/${editingBankrollId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: trimmedName,
            mode: payload.mode,
            isPublic: payload.isPublic,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Erreur modification bankroll'));
        }

        const updated = (await response.json()) as Bankroll;
        setBankrolls((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        upsertBankrollPreferences(updated.id);
        setMessage('Bankroll modifiee.');
      }

      closeBankrollDrawer();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur bankroll.');
    } finally {
      setBankrollSaving(false);
    }
  }

  function setFavorite(id: string | null) {
    if (!id) {
      return;
    }

    setSelectedBankrollId(id);
    setBankrollOrder((prev) => {
      const base = prev.length > 0 ? prev : orderedBankrolls.map((row) => row.id);
      return [id, ...base.filter((item) => item !== id)];
    });
  }

  function archiveEditingBankroll(): void {
    if (!editingBankrollId) {
      return;
    }

    upsertBankrollPreferences(editingBankrollId, true);
    closeBankrollDrawer();
    setMessage('Bankroll archivee.');
  }

  function restoreBankroll(bankrollId: string): void {
    setBankrollPreferences((prev) => {
      const previous = prev[bankrollId] ?? emptyBankrollPreferences();
      return {
        ...prev,
        [bankrollId]: {
          ...previous,
          archived: false,
        },
      };
    });
    setMessage('Bankroll restauree.');
  }

  async function deleteEditingBankroll(): Promise<void> {
    if (!editingBankrollId) {
      return;
    }

    const targetId = editingBankrollId;
    setBankrollSaving(true);
    setMessage('');
    try {
      const response = await authedFetch(`/v1/bankrolls/${targetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Suppression bankroll impossible.'));
      }

      setBankrolls((prev) => prev.filter((row) => row.id !== targetId));
      setBankrollOrder((prev) => prev.filter((id) => id !== targetId));
      setBankrollPreferences((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      closeBankrollDrawer();
      setMessage('Bankroll supprimee.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur suppression bankroll.');
    } finally {
      setBankrollSaving(false);
    }
  }

  function moveBankrollBefore(sourceId: string, targetId: string): void {
    if (sourceId === targetId) {
      return;
    }

    setBankrollOrder((prev) => {
      const base = prev.length > 0 ? prev : orderedBankrolls.map((row) => row.id);
      const withoutSource = base.filter((id) => id !== sourceId);
      const targetIndex = withoutSource.indexOf(targetId);
      if (targetIndex < 0) {
        return withoutSource;
      }
      const next = [...withoutSource];
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  }

  function addBankrollAllocation(): void {
    setBankrollFormAllocations((prev) => [...prev, createAllocation('Winamax', '')]);
  }

  function updateBankrollAllocation(
    allocationId: string,
    field: 'bookmaker' | 'capital',
    value: string,
  ): void {
    setBankrollFormAllocations((prev) =>
      prev.map((row) =>
        row.id === allocationId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function removeBankrollAllocation(allocationId: string): void {
    setBankrollFormAllocations((prev) => prev.filter((row) => row.id !== allocationId));
  }

  function openBankroll(bankrollId: string): void {
    setFavorite(bankrollId);
    closeBankrollDrawer();
    setDrawerMode('closed');
    setActiveBetId(null);
    setStatusModalBetId(null);
    setActiveMenu('favorite');
  }

  function handleChartMouseLeave(): void {
    setChartHover(null);
  }

  function handleChartMouseMove(event: MouseEvent<SVGSVGElement>): void {
    if (chartRender.layeredSeries.length === 0) {
      setChartHover(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = ((event.clientX - rect.left) / rect.width) * equityChart.width;
    const y = ((event.clientY - rect.top) / rect.height) * equityChart.height;

    if (x < equityChart.plotLeft || x > equityChart.plotRight || y < equityChart.plotTop || y > equityChart.plotBottom) {
      setChartHover(null);
      return;
    }

    let best:
      | {
          distance: number;
          seriesKey: string;
          label: string;
          color: string;
          x: number;
          y: number;
          value: number;
        }
      | null = null;

    for (const series of chartRender.layeredSeries) {
      if (series.points.length === 0) {
        continue;
      }

      const index = Math.max(
        0,
        Math.min(
          series.points.length - 1,
          Math.round(((x - equityChart.plotLeft) / Math.max(1, equityChart.plotWidth)) * (series.points.length - 1)),
        ),
      );

      const point = series.points[index];
      const valueIndex = Math.max(0, Math.min(series.values.length - 1, index));
      const value = series.values[valueIndex] ?? series.currentValue;
      const distance = Math.hypot(point.x - x, point.y - y);

      if (!best || distance < best.distance) {
        best = {
          distance,
          seriesKey: series.key,
          label: series.label,
          color: series.strokeColor,
          x: point.x,
          y: point.y,
          value,
        };
      }
    }

    if (!best) {
      setChartHover(null);
      return;
    }

    setChartHover({
      seriesKey: best.seriesKey,
      label: best.label,
      color: best.color,
      x: best.x,
      y: best.y,
      value: best.value,
    });
  }

  function updateBetDatePart(nextDate: string): void {
    if (!nextDate) {
      return;
    }

    const currentTime = betEventStart.slice(11, 16) || '00:00';
    setBetEventStart(`${nextDate}T${currentTime}`);
  }

  function updateBetTimePart(nextTime: string): void {
    if (!nextTime) {
      return;
    }

    const currentDate = betEventStart.slice(0, 10) || new Date().toISOString().slice(0, 10);
    setBetEventStart(`${currentDate}T${nextTime}`);
  }

  async function copyBetSummary(row: Bet): Promise<void> {
    const summary = [
      `Pari: ${row.legs[0]?.selection ?? 'Selection manuelle'}`,
      `Sport: ${row.sport}`,
      `Bookmaker: ${row.bookmaker ?? 'N/A'}`,
      `Cote: ${row.oddsDecimal.toFixed(3)}`,
      `Mise: ${row.stakeUnits.toFixed(2)}€`,
      `Statut: ${statusLabel(row.status)}`,
      `Benefice: ${row.profitUnits.toFixed(2)}€`,
    ].join(' | ');

    try {
      await navigator.clipboard.writeText(summary);
      setMessage('Resume du pari copie.');
    } catch {
      setMessage('Impossible de copier le resume du pari.');
    }
  }

  function renderBetEditor(isEdit: boolean) {
    const title = isEdit ? 'Modifier pari' : 'Ajouter pari';
    const actionLabel = isEdit ? 'Modifier pari' : 'Ajouter pari';
    const draftDate = betEventStart.slice(0, 10);
    const draftTime = betEventStart.slice(11, 16);

    return (
      <form className="flex h-full flex-col" onSubmit={isEdit ? onUpdateBet : onCreateBet}>
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-3xl font-bold text-[#f2fbfa]">{title}</h3>
            <button
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
              onClick={closeDrawer}
              type="button"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="bet-date">
                Date
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                id="bet-date"
                onChange={(event) => updateBetDatePart(event.target.value)}
                required
                type="date"
                value={draftDate}
              />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-event-start">
                Heure
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                id="input-event-start"
                onChange={(event) => updateBetTimePart(event.target.value)}
                required
                type="time"
                value={draftTime}
              />
            </div>
            <div className="md:col-span-12">
              <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="bet-bookmaker">
                Bookmaker
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                id="bet-bookmaker"
                onChange={(event) => setBetBookmaker(event.target.value)}
                placeholder="Unibet, Betclic, Winamax..."
                value={betBookmaker}
              />
            </div>
          </div>

          <section className="rounded-[14px] border border-white/20 bg-[#0b1324] p-4">
            <h4 className="m-0 text-lg font-bold text-[#f2fbfa]">Remplissage Magique par l'IA</h4>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <input
                  className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                  id="magic-input"
                  onChange={(event) => setMagicInput(event.target.value)}
                  placeholder="Ex: Rennes - Auxerre, victoire Rennes, cote 1.96, mise 3.28"
                  value={magicInput}
                />
              </div>
              <div className="md:col-span-4">
                <button
                  id="magic-btn"
                  className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
                    magicError ? 'bg-[#ff5d7a] text-[#0a1120]' : 'bg-[#7de8d3] text-[#0b2622]'
                  }`}
                  disabled={magicLoading}
                  onClick={() => void analyserPariMagique()}
                  type="button"
                >
                  {magicLoading ? 'Extraction...' : 'Analyser avec l IA'}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[14px] border border-white/10 bg-[#0b1324] p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-intitule">Intitule du pari</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-intitule" onChange={(event) => setBetTitle(event.target.value)} placeholder="Ex: Real Madrid - Bayern Munich" required value={betTitle} />
              </div>
              <div className="md:col-span-4">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-cote">Cote</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-cote" onChange={(event) => setBetOdds(event.target.value)} required value={betOdds} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-sport">Sport</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-sport" onChange={(event) => setBetSport(event.target.value as Sport)} value={betSport}>
                  <option value="FOOTBALL">Football</option>
                  <option value="BASKETBALL">Basketball</option>
                  <option value="TENNIS">Tennis</option>
                </select>
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="bet-status">Etat</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="bet-status" onChange={(event) => setBetStatusDraft(event.target.value as BetStatus)} value={betStatusDraft}>
                  <option value="PENDING">En attente</option>
                  <option value="WIN">Gagne</option>
                  <option value="LOSS">Perdu</option>
                </select>
              </div>
              <div className="md:col-span-12">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-comp">Competition / Marche</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-comp" onChange={(event) => setBetCompetition(event.target.value)} placeholder="Ligue 1 - France / Victoire" required value={betCompetition} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-mise">Mise (€)</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-mise" onChange={(event) => setBetStake(event.target.value)} required value={betStake} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="bet-capital">% capital</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="bet-capital" onChange={(event) => setBetPercentCapital(event.target.value)} placeholder="Ex: 5" value={betPercentCapital} />
              </div>
              <div className="md:col-span-6">
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="input-live">Pari live</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="input-live" onChange={(event) => setBetIsLive(event.target.value === 'true')} value={String(betIsLive)}>
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </select>
              </div>
            </div>
          </section>

          <button className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={() => setShowAdvancedBetOptions((prev) => !prev)} type="button">
            {showAdvancedBetOptions ? 'Masquer options' : 'Plus d options'}
          </button>
          {showAdvancedBetOptions ? (
            <section className="rounded-[14px] border border-white/10 bg-[#0b1324] p-4">
              <div className="grid grid-cols-1 gap-2 text-[#c5d2d9]">
                <label className="flex items-center gap-2"><input checked={betOptionCommission} onChange={(event) => setBetOptionCommission(event.target.checked)} type="checkbox" />Commission</label>
                <label className="flex items-center gap-2"><input checked={betOptionBonus} onChange={(event) => setBetOptionBonus(event.target.checked)} type="checkbox" />Bonus de gain</label>
                <label className="flex items-center gap-2"><input checked={betOptionFree} onChange={(event) => setBetOptionFree(event.target.checked)} type="checkbox" />Pari gratuit</label>
                <label className="flex items-center gap-2"><input checked={betOptionCashout} onChange={(event) => setBetOptionCashout(event.target.checked)} type="checkbox" />Cashout</label>
                <label className="flex items-center gap-2"><input checked={betOptionEachWay} onChange={(event) => setBetOptionEachWay(event.target.checked)} type="checkbox" />Each-Way</label>
                <label className="flex items-center gap-2"><input checked={betOptionHidden} onChange={(event) => setBetOptionHidden(event.target.checked)} type="checkbox" />Masquer</label>
              </div>
            </section>
          ) : null}

          <div>
            <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="bet-comment">Commentaire</label>
            <textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="bet-comment" onChange={(event) => setBetComment(event.target.value)} placeholder="Ajoute ton commentaire" value={betComment} />
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <button className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#6b73ff] to-[#9b4fff] px-4 py-3 text-xl font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingBet || !selectedBankrollId} type="submit">
            {savingBet ? 'Validation...' : actionLabel}
          </button>
        </div>
      </form>
    );
  }

  function renderBetDrawer() {
    if (drawerMode === 'closed') {
      return null;
    }

    if (drawerMode === 'create') {
      return renderBetEditor(false);
    }

    if (drawerMode === 'edit') {
      return renderBetEditor(true);
    }

    if (!activeBet) {
      return null;
    }

    const estimatedProbability = Math.max(5, Math.min(95, (1 / activeBet.oddsDecimal) * 100 + 8));
    const expectedValue = activeBet.stakeUnits * ((estimatedProbability / 100) * activeBet.oddsDecimal - 1);

    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-3xl font-bold text-[#f2fbfa]">{activeBet.legs[0]?.selection ?? 'Detail pari'}</h3>
            <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={closeDrawer} type="button">
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="m-0 text-2xl font-bold text-[#f2fbfa]">Selection</h4>
              <button className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusBadgeClass(activeBet.status)}`} onClick={() => setStatusModalBetId(activeBet.id)} type="button">
                {statusLabel(activeBet.status)}
              </button>
            </div>
            <p className="m-0 text-2xl font-semibold text-[#f2fbfa]">{activeBet.legs[0]?.selection ?? 'Selection manuelle'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#c5d2d9]">
              <span>{activeBet.legs[0]?.market ?? 'Marche manuel'} ??? {activeBet.sport}</span>
              {activeBet.bookmaker ? (
                <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold uppercase ${bookmakerBadgeClass(activeBet.bookmaker)}`}>
                  {activeBet.bookmaker}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-[#0b1324] p-4 md:grid-cols-4">
            <div><p className="m-0 text-sm text-[#9fb1ba]">Cote</p><p className="m-0 text-3xl font-bold text-[#f2fbfa]">{activeBet.oddsDecimal.toFixed(3)}</p></div>
            <div><p className="m-0 text-sm text-[#9fb1ba]">Mise</p><p className="m-0 text-3xl font-bold text-[#f2fbfa]">{activeBet.stakeUnits.toFixed(2)}€</p></div>
            <div><p className="m-0 text-sm text-[#9fb1ba]">Gain</p><p className={`m-0 text-3xl font-bold ${activeBet.status === 'WIN' ? 'text-[#42e0c8]' : 'text-[#ff5d7a]'}`}>{(activeBet.status === 'WIN' ? activeBet.stakeUnits * activeBet.oddsDecimal : 0).toFixed(2)}€</p></div>
            <div><p className="m-0 text-sm text-[#9fb1ba]">Benefice</p><p className={`m-0 text-3xl font-bold ${activeBet.profitUnits >= 0 ? 'text-[#42e0c8]' : 'text-[#ff5d7a]'}`}>{activeBet.profitUnits.toFixed(2)}€</p></div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4">
              <p className="m-0 text-sm text-[#9fb1ba]">Probabilite estimee</p>
              <p className="m-0 text-3xl font-bold text-[#7de8d3]">{estimatedProbability.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4">
              <p className="m-0 text-sm text-[#9fb1ba]">Valeur attendue (EV)</p>
              <p className={`m-0 text-3xl font-bold ${expectedValue >= 0 ? 'text-[#7de8d3]' : 'text-[#ff5d7a]'}`}>{expectedValue.toFixed(2)}€</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={() => openEditDrawer(activeBet.id)} type="button">Modifier</button>
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={() => setMessage('Fonction partage en preparation.')} type="button">Partager</button>
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={() => void copyBetSummary(activeBet)} type="button">Copier</button>
            <button className="rounded-xl border border-[#ff5d7a]/40 bg-[#2b1420] px-3 py-2 font-semibold text-[#ff8ea3] transition-opacity hover:opacity-90" onClick={() => setMessage('Suppression disponible dans la prochaine iteration.')} type="button">Supprimer</button>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#080d15] to-[#0a1120] p-6 text-[#f2fbfa]">
        <section className="w-full max-w-[560px] rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">EucAnalypTips</h1>
          <p className="mt-1 mb-4 text-sm text-[#c5d2d9]">Chargement de la session...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#080d15] to-[#0a1120] p-6 text-[#f2fbfa]">
        <section className="w-full max-w-[560px] rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">EucAnalypTips</h1>
          <p className="mt-1 mb-4 text-sm text-[#c5d2d9]">Eucalyptus + Analyse + Tips</p>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <button
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                  : 'border-white/10 bg-white/5 text-[#c5d2d9] hover:bg-white/10'
              }`}
              onClick={() => setMode('login')}
              type="button"
            >
              Connexion
            </button>
            <button
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'register'
                  ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                  : 'border-white/10 bg-white/5 text-[#c5d2d9] hover:bg-white/10'
              }`}
              onClick={() => setMode('register')}
              type="button"
            >
              Enregistrement
            </button>
            <button
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'forgot'
                  ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                  : 'border-white/10 bg-white/5 text-[#c5d2d9] hover:bg-white/10'
              }`}
              onClick={() => setMode('forgot')}
              type="button"
            >
              Mot de passe oublie
            </button>
          </div>

          <form onSubmit={onAuthSubmit}>
            {mode === 'register' ? (
              <>
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="name">Nom</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="name" value={name} onChange={(event) => setName(event.target.value)} required />
              </>
            ) : null}

            <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="email">Email</label>
            <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              type="email"
            />

            {mode !== 'forgot' ? (
              <>
                <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="password">Mot de passe</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                  type="password"
                />
              </>
            ) : null}

            <button className="inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="submit">
              {loading
                ? 'Chargement...'
                : mode === 'login'
                  ? 'Connexion'
                  : mode === 'register'
                    ? 'Creer mon compte'
                    : 'Envoyer le lien'}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void onResendVerification()} type="button" disabled={loading}>
              Renvoyer verification email
            </button>
          </div>

          {message ? (
            <p className={message.toLowerCase().includes('erreur') || message.toLowerCase().includes('echoue') ? 'text-sm text-[#ff5d7a]' : 'text-sm text-[#c5d2d9]'}>
              {message}
            </p>
          ) : null}
          {previewUrl ? (
            <p className="text-sm text-[#c5d2d9]">
              Lien direct dev:{' '}
              <a href={previewUrl} target="_blank" rel="noreferrer">
                ouvrir
              </a>
            </p>
          ) : null}

          <p className="mt-3 text-sm text-[#c5d2d9]">
            Verification et reset: pages dediees disponibles sur <code>/verify?token=...</code> et <code>/reset-password?token=...</code>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#080d15] to-[#0a1120] text-[#f2fbfa] md:grid md:grid-cols-[290px_1fr]">
      <aside className="border-b border-white/10 bg-[#080d15]/90 p-5 backdrop-blur-md md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">EucAnalypTips</h1>
        <p className="mt-1 mb-4 text-sm text-[#c5d2d9]">Connecte: {user.name}</p>
        <span className="inline-flex w-fit rounded-full border border-white/20 bg-[#0b1324] px-3 py-1 text-xs font-semibold text-[#f2fbfa]">{user.emailVerifiedAt ? 'Email verifie' : 'Email non verifie'}</span>

        {menuGroups.map((group) => (
          <section className="mt-5" key={group.title}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.11em] text-[#c5d2d9]">{group.title}</h2>
            {group.items.map((item) => (
              <button
                className={`mb-1.5 w-full rounded-full border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  activeMenu === item.id
                    ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'border-white/10 bg-white/5 text-[#c5d2d9] hover:bg-white/10'
                }`}
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </section>
        ))}

        <section className="mt-5">
          <button className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void clearSession()} type="button">
            Deconnexion
          </button>
        </section>
      </aside>

      <section className="p-4 md:p-6">
        {message ? (
          <p
            className={
              message.toLowerCase().includes('erreur') || message.toLowerCase().includes('impossible')
                ? 'mb-4 text-sm text-[#ff5d7a]'
                : 'mb-4 text-sm text-[#c5d2d9]'
            }
          >
            {message}
          </p>
        ) : null}
        {renderContent()}
      </section>
    </main>
  );

  function renderFavoriteWorkspace() {
    if (!selectedBankroll) {
      return (
        <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Telle bankroll</h2>
          <p className="mt-2 text-sm text-[#c5d2d9]">Selectionne d abord une bankroll depuis l onglet Bankrolls.</p>
          <button
            className="mt-3 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
            onClick={() => setActiveMenu('bankrolls')}
            type="button"
          >
            Ouvrir mes bankrolls
          </button>
        </article>
      );
    }

    return (
      <>
        <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.4)] md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">{selectedBankroll.name}</h2>
              <p className="mt-1 text-sm text-[#c5d2d9]">Workspace bankroll multi-sports en temps reel.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#7de8d3] to-[#aaf5e7] px-4 py-2 font-bold text-[#0b2622] transition-opacity hover:opacity-90"
                onClick={() => openCreateDrawer()}
                type="button"
              >
                Ajouter pari
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                onClick={() => setFavorite(selectedBankroll.id)}
                type="button"
              >
                {favoriteBankrollId === selectedBankroll.id ? 'Favori actif' : 'Mettre en favori'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-[#0b1324] px-4 py-2 text-sm font-semibold text-[#f2fbfa]">Statistiques</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#c5d2d9]">Filtres</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#c5d2d9]">Calendrier</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#c5d2d9]">Bankroll</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#c5d2d9]">Outils</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#c5d2d9]">Partager</span>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-[#091329] p-3 md:p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-[#c5d2d9]">
              <span>Courbe bankroll (90 jours)</span>
              <strong className={stats && stats.profitUnits < 0 ? 'text-[#ff5d7a]' : 'text-[#7de8d3]'}>
                {formatSignedEuro(stats?.profitUnits ?? 0)}
              </strong>
            </div>
            <svg
              className="h-72 w-full md:h-80"
              onMouseLeave={handleChartMouseLeave}
              onMouseMove={handleChartMouseMove}
              preserveAspectRatio="none"
              viewBox={`0 0 ${equityChart.width} ${equityChart.height}`}
            >
              <defs>
                {chartRender.layeredSeries.map((series) => (
                  <linearGradient id={series.gradientId} key={series.gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={series.strokeColor} stopOpacity={series.key === 'global' ? 0.24 : 0.2} />
                    <stop offset="100%" stopColor={series.strokeColor} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              {chartRender.yTicks.map((tick, index) => {
                const ratio = (chartRender.max - tick) / Math.max(1, chartRender.max - chartRender.min);
                const y = equityChart.plotTop + ratio * equityChart.plotHeight;

                return (
                  <g key={`tick-${index}`}>
                    <line
                      x1={equityChart.plotLeft}
                      x2={equityChart.plotRight}
                      y1={y}
                      y2={y}
                      className="stroke-white/10"
                    />
                    {equityChart.showSecondaryAxis ? (
                      <>
                        <text
                          x={equityChart.plotLeft - 8}
                          y={y - 2}
                          className="fill-[#9fb1ba] text-[12px]"
                          textAnchor="end"
                        >
                          {tick.toFixed(0)}€
                        </text>
                        <text
                          x={equityChart.plotLeft - 8}
                          y={y + 12}
                          className="fill-[#6f86a6] text-[10px]"
                          textAnchor="end"
                        >
                          {(
                            (equityChart.bookmakerReferenceBase ?? 0) +
                            (tick - equityChart.globalBase)
                          ).toFixed(0)}€
                        </text>
                      </>
                    ) : (
                      <text
                        x={equityChart.plotLeft - 8}
                        y={y + 4}
                        className="fill-[#9fb1ba] text-[12px]"
                        textAnchor="end"
                      >
                        {tick.toFixed(0)}€
                      </text>
                    )}
                  </g>
                );
              })}

              {chartRender.layeredSeries.map((series) =>
                series.areaPath ? (
                  <path key={`${series.key}-area`} d={series.areaPath} fill={`url(#${series.gradientId})`} />
                ) : null,
              )}

              {chartRender.layeredSeries.map((series) => (
                <path
                  key={series.key}
                  d={series.linePath}
                  fill="none"
                  stroke={series.strokeColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {chartRender.layeredSeries.map((series) => {
                const label = chartRender.labelByKey.get(series.key);
                if (!label || !series.lastPoint) {
                  return null;
                }

                return (
                  <g key={`${series.key}-label`}>
                    <line
                      x1={series.lastPoint.x}
                      x2={equityChart.plotRight + 4}
                      y1={series.lastPoint.y}
                      y2={label.y}
                      stroke={series.strokeColor}
                      strokeOpacity={0.45}
                      strokeWidth={1.5}
                    />
                    <text
                      x={equityChart.plotRight + 8}
                      y={label.y + 4}
                      className="text-[14px] font-semibold"
                      fill={label.color}
                      textAnchor="start"
                    >
                      {label.value}
                    </text>
                  </g>
                );
              })}

              {chartHover ? (() => {
                const secondaryValue =
                  equityChart.showSecondaryAxis &&
                  chartHover.seriesKey !== 'global' &&
                  equityChart.bookmakerReferenceBase !== null
                    ? (equityChart.bookmakerReferenceBase ?? 0) + (chartHover.value - equityChart.globalBase)
                    : null;

                const tooltipHeight = secondaryValue === null ? 44 : 58;
                const tooltipWidth = 164;
                const tooltipX = Math.max(
                  equityChart.plotLeft + 6,
                  Math.min(equityChart.plotRight - tooltipWidth - 6, chartHover.x + 10),
                );
                const tooltipY = Math.max(
                  equityChart.plotTop + 6,
                  Math.min(equityChart.plotBottom - tooltipHeight - 6, chartHover.y - tooltipHeight - 10),
                );

                return (
                  <g pointerEvents="none">
                    <line
                      x1={chartHover.x}
                      x2={chartHover.x}
                      y1={equityChart.plotTop}
                      y2={equityChart.plotBottom}
                      stroke={chartHover.color}
                      strokeOpacity={0.25}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                    />
                    <circle cx={chartHover.x} cy={chartHover.y} fill={chartHover.color} r={5} />
                    <rect
                      fill="#040a17"
                      height={tooltipHeight}
                      rx={10}
                      stroke="rgba(255,255,255,0.2)"
                      width={tooltipWidth}
                      x={tooltipX}
                      y={tooltipY}
                    />
                    <text
                      className="text-[11px] font-semibold uppercase"
                      fill={chartHover.color}
                      x={tooltipX + 10}
                      y={tooltipY + 16}
                    >
                      {chartHover.label}
                    </text>
                    <text
                      className="text-[14px] font-bold"
                      fill="#f2fbfa"
                      x={tooltipX + 10}
                      y={tooltipY + 33}
                    >
                      {formatCurveValue(chartHover.value)}
                    </text>
                    {secondaryValue !== null ? (
                      <text
                        className="text-[11px]"
                        fill="#9fb1ba"
                        x={tooltipX + 10}
                        y={tooltipY + 48}
                      >
                        Ref. bookmaker: {formatCurveValue(secondaryValue)}
                      </text>
                    ) : null}
                  </g>
                );
              })() : null}
            </svg>
            {showBookmakerSeriesSwitches ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {equityChart.series.map((series) => {
                  const enabled = chartSeriesVisibility[series.key] ?? true;
                  return (
                    <button
                      className={`rounded-xl border px-4 py-2 text-sm font-extrabold uppercase tracking-[0.05em] transition-colors ${
                        enabled
                          ? series.buttonClassActive
                          : 'border-white/20 bg-[#0b1324] text-[#9fb1ba] hover:bg-[#14203a]'
                      }`}
                      key={`toggle-${series.key}`}
                      onClick={() =>
                        setChartSeriesVisibility((previous) => {
                          const currentlyEnabled = previous[series.key] ?? true;
                          const enabledCount = equityChart.series.reduce(
                            (acc, item) => acc + ((previous[item.key] ?? true) ? 1 : 0),
                            0,
                          );

                          if (currentlyEnabled && enabledCount <= 1) {
                            return previous;
                          }

                          return {
                            ...previous,
                            [series.key]: !currentlyEnabled,
                          };
                        })
                      }
                      type="button"
                    >
                      {series.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-[14px] border border-white/10 bg-[#091329] p-4">
              <p className="m-0 text-sm uppercase tracking-[0.08em] text-[#9fb1ba]">Paris</p>
              <p className="mt-2 text-3xl font-bold text-[#70a6ff]">{stats?.totalBets ?? 0}</p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-[#091329] p-4">
              <p className="m-0 text-sm uppercase tracking-[0.08em] text-[#9fb1ba]">Benefice</p>
              <p className={`mt-2 text-3xl font-bold ${stats && stats.profitUnits < 0 ? 'text-[#ff5d7a]' : 'text-[#42e0c8]'}`}>
                {(stats?.profitUnits ?? 0).toFixed(2)}€
              </p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-[#091329] p-4">
              <p className="m-0 text-sm uppercase tracking-[0.08em] text-[#9fb1ba]">ROI</p>
              <p className={`mt-2 text-3xl font-bold ${stats && stats.roi < 0 ? 'text-[#ff5d7a]' : 'text-[#42e0c8]'}`}>
                {((stats?.roi ?? 0) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-[#091329] p-4">
              <p className="m-0 text-sm uppercase tracking-[0.08em] text-[#9fb1ba]">Progression</p>
              <p className={`mt-2 text-3xl font-bold ${equityChart.progression < 0 ? 'text-[#ff5d7a]' : 'text-[#42e0c8]'}`}>
                {formatSignedPercent(equityChart.progression)}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <h3 className="m-0 text-xl font-bold text-[#f2fbfa]">Journal des paris</h3>
          <p className="mt-2 text-sm text-[#c5d2d9]">Clique sur un pari pour ouvrir le volet detail. Clique sur son badge de statut pour le regler.</p>

          {historyByMonth.length === 0 ? (
            <p className="mt-4 text-sm text-[#c5d2d9]">Aucun pari enregistre pour cette bankroll.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {historyByMonth.map((month) => (
                <section key={month.key} className="rounded-xl border border-[#6366f1]/60 bg-[#070f20] p-3">
                  <button
                    className="mb-3 flex w-full items-center justify-between rounded-lg border border-transparent px-1 py-1 text-left transition-colors hover:border-white/10 hover:bg-white/5"
                    onClick={() =>
                      setCollapsedMonths((previous) => ({
                        ...previous,
                        [month.key]: !(previous[month.key] ?? false),
                      }))
                    }
                    type="button"
                  >
                    <h4 className="m-0 text-xl font-semibold capitalize text-[#98a8ff] md:text-2xl">{month.label}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${month.profit < 0 ? 'bg-[#45182a] text-[#ff5d7a]' : 'bg-[#0f3f3a] text-[#7de8d3]'}`}>
                        {formatSignedEuro(month.profit)}
                      </span>
                      <span className="text-lg text-[#c5d2d9]">{(collapsedMonths[month.key] ?? false) ? '>' : 'v'}</span>
                    </div>
                  </button>

                  {!(collapsedMonths[month.key] ?? false) ? (
                    <div className="flex flex-col gap-3">
                    {month.weeks.map((week) => (
                      <div key={week.key}>
                        <button
                          className="mb-2 flex w-full items-center justify-between rounded-md border border-transparent px-1 py-1 text-left transition-colors hover:border-white/10 hover:bg-white/5"
                          onClick={() =>
                            setCollapsedWeeks((previous) => ({
                              ...previous,
                              [week.key]: !(previous[week.key] ?? false),
                            }))
                          }
                          type="button"
                        >
                          <p className="m-0 text-base font-semibold text-[#c5d2d9] md:text-lg">{week.label}</p>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${week.profit < 0 ? 'bg-[#45182a] text-[#ff5d7a]' : 'bg-[#0f3f3a] text-[#7de8d3]'}`}>
                              {formatSignedEuro(week.profit)}
                            </span>
                            <span className="text-base text-[#9fb1ba]">{(collapsedWeeks[week.key] ?? false) ? '>' : 'v'}</span>
                          </div>
                        </button>

                        {!(collapsedWeeks[week.key] ?? false) ? (
                          <div className="flex flex-col gap-2">
                          {week.days.map((day) => (
                            <div key={day.key} className="rounded-xl border border-white/10 bg-[#050b16] p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="m-0 text-lg font-semibold capitalize text-[#f2fbfa] md:text-xl">{day.label}</p>
                                <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${day.profit < 0 ? 'bg-[#45182a] text-[#ff5d7a]' : 'bg-[#0f3f3a] text-[#7de8d3]'}`}>
                                  {formatSignedEuro(day.profit)}
                                </span>
                              </div>

                              <div className="flex flex-col gap-2">
                                {day.bets.map((row) => {
                                  const resultGain = row.status === 'WIN' ? row.stakeUnits * row.oddsDecimal : 0;
                                  const bookmaker = normalizeBookmakerLabel(row.bookmaker);
                                  const bookmakerLogo = bookmakerLogoPath(bookmaker);
                                  return (
                                    <div
                                      key={row.id}
                                      className="cursor-pointer rounded-2xl border border-white/10 bg-[#0d162a] p-3 transition-colors hover:border-[#7de8d3]/40"
                                      onClick={() => openDetailDrawer(row.id)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          openDetailDrawer(row.id);
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] lg:items-center">
                                        <div className="min-w-0">
                                          {bookmaker ? (
                                            <div className="inline-flex h-7 items-center">
                                              {bookmakerLogo ? (
                                                <img
                                                  alt={bookmaker}
                                                  className="h-6 w-auto rounded-sm border border-white/10 bg-[#0d162a] px-1 py-0.5"
                                                  src={bookmakerLogo}
                                                />
                                              ) : (
                                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-sm font-bold uppercase tracking-wide ${bookmakerBadgeClass(bookmaker)}`}>
                                                  {bookmaker}
                                                </span>
                                              )}
                                            </div>
                                          ) : null}
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className="rounded bg-[#131f3d] px-2 py-0.5 text-xs font-bold text-[#f2fbfa]">
                                              {new Date(row.eventStartAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="rounded bg-[#303f8f] px-2 py-0.5 text-xs font-semibold text-[#d9ddff]">{row.sport}</span>
                                            <span className="rounded bg-[#1f7c6f] px-2 py-0.5 text-xs font-semibold text-[#d0fff3]">{row.legs[0]?.market ?? 'Match'}</span>
                                          </div>
                                          <p className="m-0 mt-2 truncate text-2xl font-semibold text-[#f2fbfa] md:text-3xl">{row.legs[0]?.selection ?? 'Selection manuelle'}</p>
                                        </div>

                                        <div className="text-right">
                                          <p className="m-0 text-2xl font-bold text-[#f2fbfa] md:text-3xl">{row.oddsDecimal.toFixed(2)}</p>
                                          <p className="m-0 text-sm text-[#9fb1ba]">Cote</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="m-0 text-2xl font-bold text-[#f2fbfa] md:text-3xl">{formatEuroCompact(row.stakeUnits)}</p>
                                          <p className="m-0 text-sm text-[#9fb1ba]">Mise</p>
                                        </div>
                                        <div className="text-right">
                                          <p className={`m-0 text-2xl font-bold md:text-3xl ${resultGain <= 0 ? 'text-[#ff5d7a]' : 'text-[#42e0c8]'}`}>
                                            {formatEuroCompact(resultGain)}
                                          </p>
                                          <p className="m-0 text-sm text-[#9fb1ba]">Gain</p>
                                        </div>
                                        <div className="text-right">
                                          <p className={`m-0 text-2xl font-bold md:text-3xl ${row.profitUnits < 0 ? 'text-[#ff5d7a]' : 'text-[#42e0c8]'}`}>
                                            {formatEuroCompact(row.profitUnits)}
                                          </p>
                                          <p className="m-0 text-sm text-[#9fb1ba]">Benefice</p>
                                        </div>
                                        <div className="lg:justify-self-end">
                                          <button
                                            className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(row.status)}`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setStatusModalBetId(row.id);
                                            }}
                                            type="button"
                                          >
                                            {statusLabel(row.status)}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <h3 className="m-0 text-xl font-bold text-[#f2fbfa]">Statistiques bankroll</h3>
          <p className="mt-2 text-sm text-[#c5d2d9]">Vue active: {selectedBankroll.name}</p>

          <div className="mt-3 flex flex-col gap-3">
            {statsBars.map((row) => {
              const filled = Math.max(1, Math.min(10, Math.round(row.width / 10)));
              return (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <span
                        key={`${row.label}-${index}`}
                        className={`h-2.5 rounded-full ${index < filled ? (row.positive ? 'bg-[#7de8d3]' : 'bg-[#ff5d7a]') : 'bg-white/10'}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {analyticsLoading ? <p className="mt-2 text-sm text-[#c5d2d9]">Mise a jour des stats...</p> : null}

          <section className="mt-4 rounded-[14px] border border-white/20 bg-gradient-to-br from-[#0b1324] to-[#0e1624] p-4 text-[#f2fbfa]">
            <h4 className="m-0 text-lg font-bold">Coach IA Bankroll</h4>
            <p className="mt-2 text-sm text-[#c5d2d9]">L IA analyse ton profil risque/rendement et propose 3 actions concretes.</p>
            <button
              id="coach-btn"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 font-semibold text-[#f2fbfa] transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void genererConseilsCoach()}
              type="button"
            >
              {coachLoading ? 'Analyse en cours...' : 'Generer mes conseils'}
            </button>
            <div
              id="coach-output"
              className={`${coachOutput ? 'mt-2.5 block' : 'hidden'} rounded-xl bg-white/10 p-3 text-[#f2fbfa]`}
              dangerouslySetInnerHTML={{ __html: coachOutput }}
            />
            {coachFeedback ? (
              <p className={coachFeedback.toLowerCase().includes('impossible') ? 'mt-2 text-sm text-[#ff5d7a]' : 'mt-2 text-sm text-[#c5d2d9]'}>
                {coachFeedback}
              </p>
            ) : null}
          </section>
        </article>

        {drawerMode !== 'closed' ? (
          <>
            <button className="fixed inset-0 z-40 bg-[#020710]/70" onClick={closeDrawer} type="button" />
            <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[680px] overflow-y-auto border-l border-white/10 bg-[#050d1d] shadow-[0_20px_80px_rgba(0,0,0,0.7)]">
              {renderBetDrawer()}
            </aside>
          </>
        ) : null}

        {statusModalBet ? (
          <>
            <button className="fixed inset-0 z-[60] bg-[#020710]/70" onClick={() => setStatusModalBetId(null)} type="button" />
            <div className="fixed left-1/2 top-1/2 z-[61] w-[92vw] max-w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#081326] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.7)] md:p-5">
              <h4 className="m-0 text-2xl font-bold text-[#f2fbfa]">{statusModalBet.legs[0]?.selection ?? 'Pari'}</h4>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {SETTLEMENT_OPTIONS.map((option) => {
                  const isSelected = option.mappedStatus && option.mappedStatus === statusModalBet.status;
                  return (
                    <button
                      key={option.id}
                      className={`rounded-xl border px-3 py-2 text-left font-semibold transition-colors ${
                        isSelected
                          ? 'border-[#8c7bff] bg-[#2a2457] text-[#cfc7ff]'
                          : option.supported
                            ? 'border-white/10 bg-white/5 text-[#f2fbfa] hover:bg-white/10'
                            : 'cursor-not-allowed border-white/10 bg-[#101a2f] text-[#6f8094]'
                      }`}
                      disabled={!option.supported || savingBet}
                      onClick={() => {
                        if (option.mappedStatus) {
                          void onSetBetStatus(option.mappedStatus);
                        }
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10" onClick={() => setStatusModalBetId(null)} type="button">
                  Fermer
                </button>
                <button className="rounded-xl bg-gradient-to-br from-[#6b73ff] to-[#9b4fff] px-4 py-2 font-bold text-white transition-opacity hover:opacity-90" onClick={() => openEditDrawer(statusModalBet.id)} type="button">
                  Modifier
                </button>
              </div>
            </div>
          </>
        ) : null}
      </>
    );
  }

  function renderContent() {
    switch (activeMenu) {
      case 'bankrolls':
        return (
          <>
            <article className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0b1324] shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0e1624] p-4">
                <div>
                  <h2 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">Bankrolls</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 text-lg font-semibold transition-colors ${
                      bankrollOrganizeMode
                        ? 'border-[#8c7bff] bg-[#2a2457] text-[#cfc7ff]'
                        : 'border-white/10 bg-white/5 text-[#c5d2d9] hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setBankrollOrganizeMode((prev) => !prev);
                      setDragBankrollId(null);
                    }}
                    type="button"
                  >
                    Organiser
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#6b73ff] to-[#9b4fff] px-4 py-2 text-lg font-bold text-white transition-opacity hover:opacity-90"
                    onClick={openCreateBankrollDrawer}
                    type="button"
                  >
                    + Ajouter bankroll
                  </button>
                </div>
              </header>

              <div className="p-4">
                {bankrollOrganizeMode ? (
                  <p className="m-0 text-sm text-[#9fb1ba]">Mode organiser actif: clique et deplace les cartes pour changer l ordre et le favori.</p>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                  {visibleBankrolls.map((row, index) => {
                    const cardStats = bankrollCardStats[row.id] ?? { roi: 0, profit: 0 };
                    const startingCapitalValue = Number(bankrollPreferences[row.id]?.initialCapital ?? '300');
                    const startingCapital = Number.isFinite(startingCapitalValue) && startingCapitalValue > 0 ? startingCapitalValue : 300;
                    const progression = (cardStats.profit / startingCapital) * 100;
                    const isFavoriteCard = index === 0;
                    const isDragging = dragBankrollId === row.id;

                    return (
                      <article
                        aria-label={`Ouvrir ${row.name}`}
                        className={`relative rounded-2xl border bg-[#0f1930] p-4 transition-colors ${
                          isFavoriteCard ? 'border-[#2dd4bf]/40' : 'border-white/10'
                        } ${isDragging ? 'opacity-60' : 'opacity-100'} ${bankrollOrganizeMode ? 'cursor-grab' : 'cursor-pointer'}`}
                        draggable={bankrollOrganizeMode}
                        key={row.id}
                        onClick={() => {
                          if (!bankrollOrganizeMode) {
                            openBankroll(row.id);
                          }
                        }}
                        onDragEnd={() => setDragBankrollId(null)}
                        onDragOver={(event) => {
                          if (bankrollOrganizeMode && dragBankrollId && dragBankrollId !== row.id) {
                            event.preventDefault();
                          }
                        }}
                        onDragStart={() => setDragBankrollId(row.id)}
                        onDrop={() => {
                          if (bankrollOrganizeMode && dragBankrollId) {
                            moveBankrollBefore(dragBankrollId, row.id);
                            setDragBankrollId(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (bankrollOrganizeMode) {
                            return;
                          }
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openBankroll(row.id);
                          }
                        }}
                        role="button"
                        tabIndex={bankrollOrganizeMode ? -1 : 0}
                      >
                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="m-0 text-3xl font-bold text-[#f2fbfa]">{row.name}</h3>
                            {isFavoriteCard ? (
                              <span className="mt-1 inline-flex rounded-full border border-[#2dd4bf]/40 bg-[#0f3f3a] px-2 py-0.5 text-xs font-semibold text-[#7de8d3]">
                                Favori
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                setFavorite(row.id);
                              }}
                              type="button"
                            >
                              En tete
                            </button>
                            <button
                              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditBankrollDrawer(row.id);
                              }}
                              type="button"
                            >
                              Param
                            </button>
                          </div>
                        </div>

                        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/10 bg-[#16243f] p-3 text-center">
                            <p className="m-0 text-xs uppercase tracking-[0.09em] text-[#9fb1ba]">ROI</p>
                            <p className={`mt-1 text-2xl font-bold ${cardStats.roi < 0 ? 'text-[#ff5d7a]' : 'text-[#38f5ca]'}`}>
                              {(cardStats.roi * 100).toFixed(2)}%
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-[#16243f] p-3 text-center">
                            <p className="m-0 text-xs uppercase tracking-[0.09em] text-[#9fb1ba]">Progression</p>
                            <p className={`mt-1 text-2xl font-bold ${progression < 0 ? 'text-[#ff5d7a]' : 'text-[#38f5ca]'}`}>
                              {progression.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  <button
                    className="flex min-h-[196px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-[#9fb1ba] transition-colors hover:border-[#8c7bff]/70 hover:text-[#cfc7ff]"
                    onClick={openCreateBankrollDrawer}
                    type="button"
                  >
                    <span className="text-6xl leading-none">+</span>
                    <span className="mt-2 text-2xl font-semibold">Ajouter bankroll</span>
                  </button>
                </div>

                <div className="mt-5 border-t border-white/10 pt-4 text-center">
                  <p className="m-0 text-2xl font-semibold text-[#9fb1ba]">Archives ({archivedBankrolls.length})</p>
                  {archivedBankrolls.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      {archivedBankrolls.map((row) => (
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#101a2f] px-3 py-2" key={row.id}>
                          <span className="text-sm font-semibold text-[#f2fbfa]">{row.name}</span>
                          <button
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                            onClick={() => restoreBankroll(row.id)}
                            type="button"
                          >
                            Restaurer
                          </button>
                          <button
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                            onClick={() => openEditBankrollDrawer(row.id)}
                            type="button"
                          >
                            Param
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            {bankrollDrawerMode !== 'closed' ? (
              <div className="fixed inset-0 z-50 flex justify-end">
                <button
                  className="absolute inset-0 bg-[#05080f]/70"
                  onClick={closeBankrollDrawer}
                  type="button"
                />
                <aside className="relative z-10 h-full w-full max-w-[560px] border-l border-white/10 bg-[#020a19] shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
                  <form className="flex h-full flex-col" onSubmit={onSubmitBankroll}>
                    <div className="border-b border-white/10 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="m-0 text-3xl font-bold text-[#f2fbfa]">
                            {bankrollDrawerMode === 'create' ? 'Ajouter bankroll' : 'Modifier bankroll'}
                          </h3>
                          {bankrollDrawerMode === 'edit' && editingBankrollId ? (
                            <p className="mt-1 text-sm text-[#9fb1ba]">
                              {bankrolls.find((row) => row.id === editingBankrollId)?.name ?? ''}
                            </p>
                          ) : null}
                        </div>
                        <button
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                          onClick={closeBankrollDrawer}
                          type="button"
                        >
                          x
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                      <div>
                        <label className="mb-1 block text-sm text-[#9fb1ba]" htmlFor="bankroll-form-name">Nom de la bankroll</label>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                          id="bankroll-form-name"
                          onChange={(event) => setBankrollFormName(event.target.value)}
                          required
                          value={bankrollFormName}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <label className="mb-1 block text-sm text-[#9fb1ba]" htmlFor="bankroll-form-capital">Capital de depart</label>
                          <input
                            className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                            id="bankroll-form-capital"
                            inputMode="decimal"
                            onChange={(event) => setBankrollFormInitialCapital(event.target.value)}
                            value={bankrollFormInitialCapital}
                          />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mb-1 block text-sm text-[#9fb1ba]" htmlFor="bankroll-form-currency">Devise</label>
                          <select
                            className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                            id="bankroll-form-currency"
                            onChange={(event) => setBankrollFormCurrency(event.target.value as 'EUR' | 'USD')}
                            value={bankrollFormCurrency}
                          >
                            <option value="EUR">€ - Euro</option>
                            <option value="USD">USD - US Dollar</option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#0b1326] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="m-0 text-2xl font-semibold text-[#f2fbfa]">Repartir le capital sur plusieurs bookmakers</p>
                          <button
                            className={`relative h-7 w-14 rounded-full border transition-colors ${
                              bankrollFormSplitCapital ? 'border-[#8c7bff] bg-[#5145b8]' : 'border-white/20 bg-[#1a2235]'
                            }`}
                            onClick={() => setBankrollFormSplitCapital((prev) => !prev)}
                            type="button"
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                                bankrollFormSplitCapital ? 'left-8' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {bankrollFormSplitCapital ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                            <p className="m-0 text-sm font-semibold text-[#c5d2d9] md:col-span-7">Bookmaker</p>
                            <p className="m-0 text-sm font-semibold text-[#c5d2d9] md:col-span-4">Capital</p>
                          </div>
                          {bankrollFormAllocations.map((allocation) => (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-12" key={allocation.id}>
                              <div className="md:col-span-7">
                                <select
                                  className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                                  onChange={(event) => updateBankrollAllocation(allocation.id, 'bookmaker', event.target.value)}
                                  value={allocation.bookmaker}
                                >
                                  {BOOKMAKER_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="md:col-span-4">
                                <input
                                  className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50"
                                  inputMode="decimal"
                                  onChange={(event) => updateBankrollAllocation(allocation.id, 'capital', event.target.value)}
                                  placeholder="100"
                                  value={allocation.capital}
                                />
                              </div>
                              <div className="md:col-span-1">
                                <button
                                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base font-semibold text-[#c5d2d9] md:text-lg transition-colors hover:bg-white/10"
                                  onClick={() => removeBankrollAllocation(allocation.id)}
                                  type="button"
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-4 py-2 text-base font-semibold text-[#c5d2d9] md:text-lg transition-colors hover:bg-white/10"
                            onClick={addBankrollAllocation}
                            type="button"
                          >
                            Ajouter un bookmaker
                          </button>
                        </div>
                      ) : null}

                      <div>
                        <p className="m-0 text-2xl font-semibold text-[#f2fbfa]">Affichage des cotes</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {(['DECIMAL', 'AMERICAN', 'FRACTIONAL'] as OddsDisplay[]).map((value) => (
                            <button
                              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                                bankrollFormOddsDisplay === value
                                  ? 'border-[#8c7bff] bg-[#2a2457] text-[#cfc7ff]'
                                  : 'border-white/10 bg-[#0b1326] text-[#c5d2d9] hover:bg-white/10'
                              }`}
                              key={value}
                              onClick={() => setBankrollFormOddsDisplay(value)}
                              type="button"
                            >
                              <span className="block text-lg font-bold">
                                {value === 'DECIMAL' ? 'Decimale' : value === 'AMERICAN' ? 'Americaine' : 'Fractionnaire'}
                              </span>
                              <span className="mt-1 block text-xs text-[#9fb1ba]">
                                {value === 'DECIMAL' ? '1.75' : value === 'AMERICAN' ? '-133' : '8/11'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="m-0 text-2xl font-semibold text-[#f2fbfa]">Statut</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {(['PUBLIC', 'PRIVATE', 'STRICT'] as BankrollVisibility[]).map((value) => (
                            <button
                              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                                bankrollFormVisibility === value
                                  ? 'border-[#8c7bff] bg-[#2a2457] text-[#cfc7ff]'
                                  : 'border-white/10 bg-[#0b1326] text-[#c5d2d9] hover:bg-white/10'
                              }`}
                              key={value}
                              onClick={() => setBankrollFormVisibility(value)}
                              type="button"
                            >
                              <span className="block text-lg font-bold">{value === 'PUBLIC' ? 'Public' : value === 'PRIVATE' ? 'Privee' : 'Strict'}</span>
                            </button>
                          ))}
                        </div>
                        {bankrollFormVisibility === 'STRICT' ? (
                          <p className="mt-2 text-sm leading-relaxed text-[#ff7f97]">
                            En gestion STRICT, les actions sur ta bankroll sont limitees.
                            <br />
                            - Le statut restera strict/public.
                            <br />
                            - La modification du pari est limitee (hors etat).
                            <br />
                            - La suppression des paris est impossible.
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-[#9fb1ba]">Si la bankroll est publique, elle reste visible pour tout le monde.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/10 p-5">
                      <button
                        className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#6b73ff] to-[#9b4fff] px-4 py-3 text-xl font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={bankrollSaving}
                        type="submit"
                      >
                        {bankrollSaving
                          ? 'Sauvegarde...'
                          : bankrollDrawerMode === 'create'
                            ? 'Ajouter bankroll'
                            : 'Modifier bankroll'}
                      </button>

                      {bankrollDrawerMode === 'edit' ? (
                        <>
                          <button
                            className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-base font-semibold text-[#c5d2d9] md:text-lg transition-colors hover:bg-white/10"
                            onClick={archiveEditingBankroll}
                            type="button"
                          >
                            Archiver bankroll
                          </button>
                          <button
                            className="inline-flex w-full items-center justify-center rounded-xl border border-[#ff5d7a]/40 bg-[#2b1420] px-4 py-2 text-lg font-semibold text-[#ff8ea3] transition-opacity hover:opacity-90"
                            onClick={deleteEditingBankroll}
                            type="button"
                          >
                            Supprimer bankroll
                          </button>
                        </>
                      ) : null}
                    </div>
                  </form>
                </aside>
              </div>
            ) : null}
          </>
        );

      case 'favorite':
        return renderFavoriteWorkspace();

      case 'analyseur':
        return (
          <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Analyseur</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">
              Vue analytique globale. La saisie et la gestion des paris sont maintenant dans chaque bankroll.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4 md:col-span-4">
                <p className="m-0 text-sm text-[#c5d2d9]">Bankroll active</p>
                <p className="mt-2 text-xl font-bold text-[#f2fbfa]">{selectedBankroll?.name ?? 'Aucune'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4 md:col-span-4">
                <p className="m-0 text-sm text-[#c5d2d9]">Paris analyses</p>
                <p className="mt-2 text-xl font-bold text-[#f2fbfa]">{stats?.totalBets ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0b1324] p-4 md:col-span-4">
                <p className="m-0 text-sm text-[#c5d2d9]">Profit global</p>
                <p className={`mt-2 text-xl font-bold ${stats && stats.profitUnits < 0 ? 'text-[#ff5d7a]' : 'text-[#7de8d3]'}`}>
                  {(stats?.profitUnits ?? 0).toFixed(2)}€
                </p>
              </div>
            </div>

            <div className="mt-4">
              <button
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
                onClick={() => setActiveMenu('favorite')}
                type="button"
              >
                Ouvrir la bankroll en detail
              </button>
            </div>
          </article>
        );

      case 'optimiseur':
        return (
          <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Optimiseur</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Espace pour optimiser intelligemment les prises de paris.</p>
            <p className="text-sm text-[#c5d2d9]">Base en place. On branchera les regles d optimisation precises quand tu me les donnes.</p>
          </article>
        );

      case 'bilans':
        return (
          <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Bilans</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Analyse long terme orientee resultats pecuniers.</p>
            <p className="text-sm text-[#c5d2d9]">Structure prete pour recevoir les bilans hebdo/mensuels/trimestriels/all-time.</p>
          </article>
        );

      case 'configurations':
        return (
          <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Configurations</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Reglage de l application selon tes attentes.</p>
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-[#c5d2d9]">
              <li>Base URL API: {API_BASE_URL}</li>
              <li>Auth web: tokens Bearer + refresh automatique</li>
              <li>Preferences detaillees a brancher avec toi ensuite</li>
            </ul>
          </article>
        );

      case 'mes-suivis':
        return (
          <>
            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Mes suivis</h2>
              <p className="mt-2 text-sm text-[#c5d2d9]">Tipsters et bankrolls que tu suis.</p>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                <button
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                    followTab === 'tipsters'
                      ? 'border border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                      : 'border border-transparent text-[#c5d2d9] hover:bg-white/10'
                  }`}
                  onClick={() => setFollowTab('tipsters')}
                  type="button"
                >
                  Tipsters
                </button>
                <button
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                    followTab === 'bankrolls'
                      ? 'border border-white/20 bg-[#0b1324] text-[#f2fbfa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                      : 'border border-transparent text-[#c5d2d9] hover:bg-white/10'
                  }`}
                  onClick={() => setFollowTab('bankrolls')}
                  type="button"
                >
                  Bankrolls
                </button>
              </div>
            </article>

            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              {followTab === 'tipsters' ? (
                <>
                  <h3 className="m-0 text-xl font-bold text-[#f2fbfa]">Suivis Tipsters</h3>
                  <p className="text-sm text-[#c5d2d9]">Aucun tipster suivi pour le moment.</p>
                </>
              ) : (
                <>
                  <h3 className="m-0 text-xl font-bold text-[#f2fbfa]">Suivis Bankrolls</h3>
                  <p className="text-sm text-[#c5d2d9]">Aucune bankroll suivie pour le moment.</p>
                </>
              )}
            </article>
          </>
        );

      case 'activites':
        return (
          <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Activites</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Dernieres activites de tes suivis: matchs, bankrolls, tipsters.</p>
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-[#c5d2d9]">
              <li>Flux activite branche, en attente des regles de feed.</li>
              <li>Support des types: match, bankroll, tipster.</li>
              <li>Chronologie triable par date et type.</li>
            </ul>
          </article>
        );

      case 'montantes':
        return (
          <>
            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Montantes</h2>
              <p className="mt-2 text-sm text-[#c5d2d9]">Pilotage simple d une montante.</p>
            </article>
            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="montante-start">Mise de depart</label>
                  <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="montante-start" onChange={(e) => setMontanteStart(e.target.value)} value={montanteStart} />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="montante-steps">Nombre d etapes</label>
                  <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="montante-steps" onChange={(e) => setMontanteSteps(e.target.value)} value={montanteSteps} />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="montante-rate">Cote moyenne</label>
                  <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="montante-rate" onChange={(e) => setMontanteRate(e.target.value)} value={montanteRate} />
                </div>
              </div>
              <p className="mt-2.5 text-sm text-[#c5d2d9]">
                Resultat potentiel: <strong>{montanteResult ? `${montanteResult.toFixed(2)}€` : 'N/A'}</strong>
              </p>
            </article>
          </>
        );

      case 'calculateurs':
        return (
          <>
            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <h2 className="m-0 text-2xl font-bold tracking-tight text-[#f2fbfa]">Calculateurs</h2>
              <p className="mt-2 text-sm text-[#c5d2d9]">Outils de calcul essentiels pour les paris sportifs.</p>
            </article>
            <article className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="calc-odds">Cote decimale</label>
                  <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="calc-odds" onChange={(e) => setCalcOdds(e.target.value)} value={calcOdds} />
                </div>
                <div className="md:col-span-6">
                  <label className="mb-1 block text-sm text-[#c5d2d9]" htmlFor="calc-stake">Mise</label>
                  <input className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" id="calc-stake" onChange={(e) => setCalcStake(e.target.value)} value={calcStake} />
                </div>
              </div>
              <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-[#c5d2d9]">
                <li>Probabilite implicite: {impliedProbability ? `${impliedProbability.toFixed(2)}%` : 'N/A'}</li>
                <li>Retour brut: {grossReturn ? `${grossReturn.toFixed(2)}€` : 'N/A'}</li>
                <li>Profit net: {grossReturn ? `${(grossReturn - Number(calcStake || 0)).toFixed(2)}€` : 'N/A'}</li>
              </ul>
            </article>
          </>
        );

      default:
        return null;
    }
  }
}











































