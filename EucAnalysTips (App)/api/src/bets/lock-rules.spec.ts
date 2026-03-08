import type { Bet } from '@nouveau/types';
import { isBetEditable } from './lock-rules';

describe('lock rules', () => {
  const baseBet: Bet = {
    id: 'b1',
    bankrollId: 'bk1',
    userId: 'u1',
    sport: 'FOOTBALL',
    stakeUnits: 1,
    oddsDecimal: 2,
    isLive: false,
    eventStartAt: '2026-12-20T12:00:00.000Z',
    status: 'PENDING',
    profitUnits: 0,
    createdAt: '2026-12-20T10:00:00.000Z',
    updatedAt: '2026-12-20T10:00:00.000Z',
    lockedAt: null,
    legs: [],
  };

  it('allows edit for FLEX_EDIT mode', () => {
    expect(isBetEditable(baseBet, 'FLEX_EDIT')).toBe(true);
  });

  it('denies edit for SECURE_LOCKED when match started', () => {
    const now = new Date('2026-12-20T12:30:00.000Z').getTime();
    expect(isBetEditable(baseBet, 'SECURE_LOCKED', now)).toBe(false);
  });

  it('denies edit for secure live bet even before event start', () => {
    expect(
      isBetEditable(
        {
          ...baseBet,
          isLive: true,
        },
        'SECURE_LOCKED',
        new Date('2026-12-20T11:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });

  it('allows edit for secure pre-match bet before event start', () => {
    const now = new Date('2026-12-20T11:00:00.000Z').getTime();
    expect(isBetEditable(baseBet, 'SECURE_LOCKED', now)).toBe(true);
  });
});
