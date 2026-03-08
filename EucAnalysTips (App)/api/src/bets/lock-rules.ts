import type { Bet, BankrollMode } from '@nouveau/types';

export function isBetEditable(bet: Bet, mode: BankrollMode, nowMs: number = Date.now()): boolean {
  if (mode === 'FLEX_EDIT') {
    return true;
  }

  if (bet.isLive || bet.lockedAt) {
    return false;
  }

  return nowMs < new Date(bet.eventStartAt).getTime();
}
