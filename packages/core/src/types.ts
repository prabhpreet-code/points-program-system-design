// Core data types for the HyperUnicorn points system.
//
// Time is represented in seconds since epoch as a plain number.
// USD amounts are plain numbers (not bigints) — this is a mock dataset.

export type Timestamp = number;
export type UserId = string;
export type PositionId = string;
export type Pair = 'ETH/USDC' | 'WBTC/USDC';
export type Side = 'LONG' | 'SHORT';

export type Archetype =
  | 'WHALE_VAULT'
  | 'STEADY_VAULT'
  | 'ACTIVE_LP'
  | 'PARKED_LP'
  | 'PERP_BUYER_LONG'
  | 'HYBRID'
  | 'FLASH_FARMER'
  | 'DUST_SPAMMER'
  | 'NEWCOMER';

export interface UserProfile {
  id: UserId;
  label: string;
  archetype: Archetype;
}

// ────────────────────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────────────────────

export type UserEvent =
  | { kind: 'VAULT_DEPOSIT'; ts: Timestamp; user: UserId; amountUsd: number }
  | { kind: 'VAULT_WITHDRAW'; ts: Timestamp; user: UserId; amountUsd: number }
  | {
      kind: 'LP_OPEN';
      ts: Timestamp;
      user: UserId;
      positionId: PositionId;
      pair: Pair;
      notionalUsd: number;
      rangeLowerPx: number;
      rangeUpperPx: number;
    }
  | { kind: 'LP_CLOSE'; ts: Timestamp; user: UserId; positionId: PositionId }
  | {
      kind: 'TAKER_OPEN';
      ts: Timestamp;
      user: UserId;
      positionId: PositionId;
      pair: Pair;
      side: Side;
      notionalUsd: number;
    }
  | { kind: 'TAKER_CLOSE'; ts: Timestamp; user: UserId; positionId: PositionId };

export interface PriceTick {
  ts: Timestamp;
  pair: Pair;
  price: number;
  // Funding rate on this pair at this instant, expressed as dollars paid per
  // dollar of taker notional per second. Positive → longs pay, shorts receive.
  fundingRate: number;
}

export interface EventStream {
  users: UserProfile[];
  events: UserEvent[];
  prices: PriceTick[];
  startTs: Timestamp;
  endTs: Timestamp;
}

// ────────────────────────────────────────────────────────────────────────────
// Scorer output
// ────────────────────────────────────────────────────────────────────────────

export interface Breakdown {
  vault: number;
  directLp: number;
  taker: number;
}

export interface HourlyPoint extends Breakdown {
  ts: Timestamp;
  total: number;
  rawTotal: number; // cumulative total before daily saturation
}

export interface PositionContribution {
  positionId: PositionId;
  kind: 'LP' | 'TAKER';
  pair: Pair;
  openedAt: Timestamp;
  closedAt: Timestamp | null;
  notionalUsd: number;
  points: number;
  eligible: boolean; // false if pruned by min-duration or min-notional
}

export interface UserScore {
  user: UserId;
  total: number;
  rawTotal: number; // before saturation
  breakdown: Breakdown;
  rawBreakdown: Breakdown;
  timeseries: HourlyPoint[]; // cumulative, post-saturation
  positions: PositionContribution[];
}

export interface ScoreOutput {
  startTs: Timestamp;
  endTs: Timestamp;
  scores: UserScore[];
}
