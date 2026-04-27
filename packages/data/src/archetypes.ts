// Each archetype translates a user's intended behaviour into a time-ordered
// list of UserEvents. Deterministic given an Rng seed.

import type {
  Archetype,
  Pair,
  PriceTick,
  Timestamp,
  UserEvent,
  UserId,
  UserProfile,
} from '@hyperunicorn/core';
import { SECONDS } from '@hyperunicorn/core';
import type { Rng } from './rng.js';

interface Ctx {
  user: UserId;
  rng: Rng;
  startTs: Timestamp;
  endTs: Timestamp;
  priceAt: (ts: Timestamp, pair: Pair) => number;
}

let globalPositionCounter = 0;
const pid = () => `p${(globalPositionCounter += 1).toString(36)}`;

export function buildArchetypeEvents(
  profile: UserProfile,
  ctx: Ctx,
): UserEvent[] {
  switch (profile.archetype) {
    case 'WHALE_VAULT':
      return whaleVault(ctx);
    case 'STEADY_VAULT':
      return steadyVault(ctx);
    case 'ACTIVE_LP':
      return activeLp(ctx);
    case 'PARKED_LP':
      return parkedLp(ctx);
    case 'PERP_BUYER_LONG':
      return perpBuyerLong(ctx);
    case 'HYBRID':
      return hybrid(ctx);
    case 'FLASH_FARMER':
      return flashFarmer(ctx);
    case 'DUST_SPAMMER':
      return dustSpammer(ctx);
    case 'NEWCOMER':
      return newcomer(ctx);
  }
}

// ────────────────────────────────────────────────────────────────────────────

function whaleVault({ user, startTs }: Ctx): UserEvent[] {
  return [
    { kind: 'VAULT_DEPOSIT', ts: startTs + SECONDS.HOUR, user, amountUsd: 500_000 },
  ];
}

function steadyVault({ user, startTs }: Ctx): UserEvent[] {
  return [
    { kind: 'VAULT_DEPOSIT', ts: startTs + SECONDS.HOUR, user, amountUsd: 20_000 },
    { kind: 'VAULT_DEPOSIT', ts: startTs + 15 * SECONDS.DAY, user, amountUsd: 5_000 },
  ];
}

function activeLp({ user, startTs, endTs, rng, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  const pair: Pair = 'ETH/USDC';
  const holdFor = 3 * SECONDS.DAY;
  for (let t = startTs + SECONDS.HOUR; t + holdFor <= endTs; t += holdFor + SECONDS.HOUR) {
    const price = priceAt(t, pair);
    const halfWidth = price * 0.05; // ±5% — narrow
    const positionId = pid();
    events.push({
      kind: 'LP_OPEN',
      ts: t,
      user,
      positionId,
      pair,
      notionalUsd: 5_000 + rng.int(-500, 500),
      rangeLowerPx: price - halfWidth,
      rangeUpperPx: price + halfWidth,
    });
    events.push({ kind: 'LP_CLOSE', ts: t + holdFor, user, positionId });
  }
  return events;
}

function parkedLp({ user, startTs, endTs, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  const pair: Pair = 'ETH/USDC';
  const price0 = priceAt(startTs + SECONDS.HOUR, pair);
  // Two wide positions, opened and held
  for (const offset of [-0.2, +0.2]) {
    const center = price0 * (1 + offset);
    const halfWidth = price0 * 0.2;
    events.push({
      kind: 'LP_OPEN',
      ts: startTs + SECONDS.HOUR,
      user,
      positionId: pid(),
      pair,
      notionalUsd: 20_000,
      rangeLowerPx: center - halfWidth,
      rangeUpperPx: center + halfWidth,
    });
  }
  // One BTC position as well
  const btcPx = priceAt(startTs + SECONDS.HOUR, 'WBTC/USDC');
  events.push({
    kind: 'LP_OPEN',
    ts: startTs + 2 * SECONDS.HOUR,
    user,
    positionId: pid(),
    pair: 'WBTC/USDC',
    notionalUsd: 15_000,
    rangeLowerPx: btcPx * 0.85,
    rangeUpperPx: btcPx * 1.15,
  });
  // Held to end (no close events)
  void endTs;
  return events;
}

function perpBuyerLong({ user, startTs, endTs, rng }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  const pair: Pair = 'ETH/USDC';
  // 4 long stretches of ~4 days each
  const stretchLen = 4 * SECONDS.DAY;
  const gap = 2 * SECONDS.DAY;
  for (
    let t = startTs + 2 * SECONDS.HOUR;
    t + stretchLen < endTs;
    t += stretchLen + gap
  ) {
    const positionId = pid();
    events.push({
      kind: 'TAKER_OPEN',
      ts: t,
      user,
      positionId,
      pair,
      side: 'LONG',
      notionalUsd: 10_000 + rng.int(-1_000, 1_000),
    });
    events.push({ kind: 'TAKER_CLOSE', ts: t + stretchLen, user, positionId });
  }
  return events;
}

function hybrid({ user, startTs, endTs, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  events.push({ kind: 'VAULT_DEPOSIT', ts: startTs + SECONDS.HOUR, user, amountUsd: 5_000 });

  // One medium LP held throughout
  const price = priceAt(startTs + SECONDS.HOUR, 'ETH/USDC');
  events.push({
    kind: 'LP_OPEN',
    ts: startTs + 2 * SECONDS.HOUR,
    user,
    positionId: pid(),
    pair: 'ETH/USDC',
    notionalUsd: 3_000,
    rangeLowerPx: price * 0.92,
    rangeUpperPx: price * 1.08,
  });

  // Two taker positions in the second half
  const takerPid = pid();
  events.push({
    kind: 'TAKER_OPEN',
    ts: startTs + 16 * SECONDS.DAY,
    user,
    positionId: takerPid,
    pair: 'ETH/USDC',
    side: 'LONG',
    notionalUsd: 2_000,
  });
  events.push({
    kind: 'TAKER_CLOSE',
    ts: Math.min(startTs + 22 * SECONDS.DAY, endTs),
    user,
    positionId: takerPid,
  });
  return events;
}

function flashFarmer({ user, startTs, endTs, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  // Huge vault deposit late, withdraw next day.
  const flashIn = endTs - 2 * SECONDS.DAY;
  const flashOut = endTs - SECONDS.DAY;
  events.push({ kind: 'VAULT_DEPOSIT', ts: flashIn, user, amountUsd: 200_000 });
  events.push({ kind: 'VAULT_WITHDRAW', ts: flashOut, user, amountUsd: 200_000 });

  // Flash LP: 2h, well under the min-duration gate.
  const lpTs = startTs + 5 * SECONDS.DAY;
  const lpId = pid();
  const price = priceAt(lpTs, 'ETH/USDC');
  events.push({
    kind: 'LP_OPEN',
    ts: lpTs,
    user,
    positionId: lpId,
    pair: 'ETH/USDC',
    notionalUsd: 50_000,
    rangeLowerPx: price * 0.98,
    rangeUpperPx: price * 1.02,
  });
  events.push({ kind: 'LP_CLOSE', ts: lpTs + 2 * SECONDS.HOUR, user, positionId: lpId });

  return events;
}

function dustSpammer({ user, startTs, endTs, rng, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  // Open dozens of below-min-notional LPs.
  for (let t = startTs + SECONDS.HOUR; t < endTs; t += 6 * SECONDS.HOUR) {
    const price = priceAt(t, 'ETH/USDC');
    const positionId = pid();
    events.push({
      kind: 'LP_OPEN',
      ts: t,
      user,
      positionId,
      pair: 'ETH/USDC',
      notionalUsd: 30 + rng.int(0, 15), // below MIN_NOTIONAL_USD = 50
      rangeLowerPx: price * 0.95,
      rangeUpperPx: price * 1.05,
    });
    events.push({
      kind: 'LP_CLOSE',
      ts: t + 2 * SECONDS.HOUR,
      user,
      positionId,
    });
  }
  return events;
}

function newcomer({ user, startTs, endTs, priceAt }: Ctx): UserEvent[] {
  const events: UserEvent[] = [];
  const joinTs = startTs + 15 * SECONDS.DAY;

  events.push({ kind: 'VAULT_DEPOSIT', ts: joinTs, user, amountUsd: 2_000 });
  events.push({
    kind: 'VAULT_DEPOSIT',
    ts: joinTs + 4 * SECONDS.DAY,
    user,
    amountUsd: 3_000,
  });

  // First LP mid-ramp
  const price = priceAt(joinTs + 2 * SECONDS.DAY, 'ETH/USDC');
  events.push({
    kind: 'LP_OPEN',
    ts: joinTs + 2 * SECONDS.DAY,
    user,
    positionId: pid(),
    pair: 'ETH/USDC',
    notionalUsd: 2_000,
    rangeLowerPx: price * 0.9,
    rangeUpperPx: price * 1.1,
  });
  void endTs;
  return events;
}

// ────────────────────────────────────────────────────────────────────────────

export const USERS: UserProfile[] = [
  { id: '0xWhale', label: 'Whale (vault)', archetype: 'WHALE_VAULT' },
  { id: '0xSteady', label: 'Steady (vault)', archetype: 'STEADY_VAULT' },
  { id: '0xActive', label: 'Active LP', archetype: 'ACTIVE_LP' },
  { id: '0xParked', label: 'Parked LP', archetype: 'PARKED_LP' },
  { id: '0xLonger', label: 'Perp buyer (long)', archetype: 'PERP_BUYER_LONG' },
  { id: '0xHybrid', label: 'Hybrid strategist', archetype: 'HYBRID' },
  { id: '0xFlash', label: 'Flash farmer', archetype: 'FLASH_FARMER' },
  { id: '0xDust', label: 'Dust spammer', archetype: 'DUST_SPAMMER' },
  { id: '0xNewbie', label: 'Newcomer', archetype: 'NEWCOMER' },
];

export type { Archetype };

// Reset counter for deterministic re-runs
export function resetPositionCounter(): void {
  globalPositionCounter = 0;
}
