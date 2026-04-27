// Event-sourced continuous-accrual scorer.
//
// Walks a merged, time-ordered stream of user events and price ticks. State is
// piecewise-constant between events, so the integral collapses to a sum of
// (rate · Δt) slices. Per-position accrual is tracked separately so that the
// min-duration gate can prune ineligible positions at the end without losing
// shape of the timeseries.

import { CALIBRATION } from './calibration.js';
import type {
  Breakdown,
  EventStream,
  HourlyPoint,
  Pair,
  PositionContribution,
  PositionId,
  PriceTick,
  ScoreOutput,
  Side,
  UserEvent,
  UserId,
  UserScore,
} from './types.js';

interface PositionAccrual {
  user: UserId;
  positionId: PositionId;
  kind: 'LP' | 'TAKER';
  pair: Pair;
  notionalUsd: number;
  rangeLowerPx?: number;
  rangeUpperPx?: number;
  side?: Side;
  openTs: number;
  closedAt: number | null;
  hourly: number[];
  total: number;
}

type MergedEvent =
  | { t: 'USER'; ts: number; ev: UserEvent }
  | { t: 'PRICE'; ts: number; ev: PriceTick };

export function computeScores(stream: EventStream): ScoreOutput {
  const { users, events, prices, startTs, endTs } = stream;

  const merged: MergedEvent[] = [
    ...prices.map((ev): MergedEvent => ({ t: 'PRICE', ts: ev.ts, ev })),
    ...events.map((ev): MergedEvent => ({ t: 'USER', ts: ev.ts, ev })),
  ].sort(
    (a, b) =>
      a.ts - b.ts ||
      // When ties occur, process PRICE first so that user actions at the same
      // instant see the latest price.
      (a.t === b.t ? 0 : a.t === 'PRICE' ? -1 : 1),
  );

  const hourCount = Math.max(
    1,
    Math.ceil((endTs - startTs) / CALIBRATION.SNAPSHOT_STEP_SECONDS),
  );
  const mkHourly = () => Array.from({ length: hourCount }, () => 0);

  const vaultBalance = new Map<UserId, number>();
  const vaultHourly = new Map<UserId, number[]>();
  for (const u of users) {
    vaultBalance.set(u.id, 0);
    vaultHourly.set(u.id, mkHourly());
  }

  const positions = new Map<PositionId, PositionAccrual>();
  const openLP = new Map<PositionId, PositionAccrual>();
  const openTaker = new Map<PositionId, PositionAccrual>();

  const priceState = new Map<Pair, { price: number; fundingRate: number }>();

  let cursor = startTs;

  const accrueBetween = (from: number, to: number) => {
    if (to <= from) return;
    let t = from;
    while (t < to) {
      const hourIdx = clamp(
        Math.floor((t - startTs) / CALIBRATION.SNAPSHOT_STEP_SECONDS),
        0,
        hourCount - 1,
      );
      const hourEnd = startTs + (hourIdx + 1) * CALIBRATION.SNAPSHOT_STEP_SECONDS;
      const chunkEnd = Math.min(to, hourEnd);
      const dt = chunkEnd - t;
      if (dt > 0) {
        // Vault — constant balance between events, straight multiplication
        for (const [userId, bal] of vaultBalance) {
          if (bal <= 0) continue;
          const add = CALIBRATION.k_V * bal * dt;
          vaultHourly.get(userId)![hourIdx]! += add;
        }

        // Direct LP — notional held at open, S factor from current price
        for (const p of openLP.values()) {
          if (p.notionalUsd < CALIBRATION.MIN_NOTIONAL_USD) continue;
          const ps = priceState.get(p.pair);
          if (!ps) continue;
          const inRange =
            ps.price >= (p.rangeLowerPx ?? -Infinity) &&
            ps.price <= (p.rangeUpperPx ?? Infinity);
          const S = inRange ? CALIBRATION.S_IN : CALIBRATION.S_OUT;
          const add = CALIBRATION.k_L * p.notionalUsd * S * dt;
          p.hourly[hourIdx]! += add;
          p.total += add;
        }

        // Direct Taker — points only when user is paying funding
        for (const p of openTaker.values()) {
          if (p.notionalUsd < CALIBRATION.MIN_NOTIONAL_USD) continue;
          const ps = priceState.get(p.pair);
          if (!ps) continue;
          const sign = p.side === 'LONG' ? 1 : -1;
          const payRate = sign * ps.fundingRate * p.notionalUsd; // USD/sec
          if (payRate <= 0) continue;
          const add = CALIBRATION.k_T * payRate * dt;
          p.hourly[hourIdx]! += add;
          p.total += add;
        }
      }
      t = chunkEnd;
    }
  };

  for (const m of merged) {
    if (m.ts < startTs) continue;
    if (m.ts > endTs) break;
    accrueBetween(cursor, m.ts);
    cursor = m.ts;
    if (m.t === 'PRICE') {
      priceState.set(m.ev.pair, { price: m.ev.price, fundingRate: m.ev.fundingRate });
    } else {
      applyUserEvent(m.ev, {
        vaultBalance,
        openLP,
        openTaker,
        positions,
        hourCount,
      });
    }
  }
  accrueBetween(cursor, endTs);

  // ─── Finalize positions ───────────────────────────────────────────────────
  // Still-open positions are closed implicitly at endTs for the duration check.
  for (const p of positions.values()) {
    if (p.closedAt === null) p.closedAt = endTs;
  }

  // Per-user hourly raw accrual split by category.
  const lpHourly = new Map<UserId, number[]>();
  const takerHourly = new Map<UserId, number[]>();
  for (const u of users) {
    lpHourly.set(u.id, mkHourly());
    takerHourly.set(u.id, mkHourly());
  }

  const positionContribs = new Map<UserId, PositionContribution[]>();
  for (const u of users) positionContribs.set(u.id, []);

  for (const p of positions.values()) {
    const duration = (p.closedAt ?? endTs) - p.openTs;
    const eligible =
      duration >= CALIBRATION.MIN_DURATION_SECONDS &&
      p.notionalUsd >= CALIBRATION.MIN_NOTIONAL_USD;
    const bucket = p.kind === 'LP' ? lpHourly : takerHourly;
    if (eligible) {
      const arr = bucket.get(p.user)!;
      for (let i = 0; i < hourCount; i += 1) arr[i]! += p.hourly[i]!;
    }
    positionContribs.get(p.user)!.push({
      positionId: p.positionId,
      kind: p.kind,
      pair: p.pair,
      openedAt: p.openTs,
      closedAt: p.closedAt,
      notionalUsd: p.notionalUsd,
      points: eligible ? p.total : 0,
      eligible,
    });
  }

  // ─── Apply per-user 24h saturation as a post-process ──────────────────────
  const scores: UserScore[] = users.map((u) => {
    const vH = vaultHourly.get(u.id)!;
    const lH = lpHourly.get(u.id)!;
    const tH = takerHourly.get(u.id)!;

    const rawBreakdown: Breakdown = {
      vault: sum(vH),
      directLp: sum(lH),
      taker: sum(tH),
    };
    const rawTotal = rawBreakdown.vault + rawBreakdown.directLp + rawBreakdown.taker;

    // Bucket by 24h windows; compute multiplier per bucket; apply uniformly.
    const hoursPerBucket = Math.max(
      1,
      Math.round(CALIBRATION.SNAPSHOT_STEP_SECONDS / 3600) * 24,
    );
    // SNAPSHOT_STEP_SECONDS is 3600, so hoursPerBucket = 24. Kept explicit for
    // clarity in case cadence changes.
    const multipliers: number[] = [];
    for (let i = 0; i < hourCount; i += hoursPerBucket) {
      let rawSum = 0;
      for (let j = i; j < Math.min(i + hoursPerBucket, hourCount); j += 1) {
        rawSum += vH[j]! + lH[j]! + tH[j]!;
      }
      const eff = saturate(rawSum, CALIBRATION.SATURATION_X0_PER_DAY);
      multipliers.push(rawSum > 0 ? eff / rawSum : 1);
    }

    const timeseries: HourlyPoint[] = [];
    let cumV = 0;
    let cumL = 0;
    let cumT = 0;
    let rawCum = 0;
    for (let i = 0; i < hourCount; i += 1) {
      rawCum += vH[i]! + lH[i]! + tH[i]!;
      const mult = multipliers[Math.floor(i / hoursPerBucket)]!;
      const v = vH[i]! * mult;
      const l = lH[i]! * mult;
      const tk = tH[i]! * mult;
      cumV += v;
      cumL += l;
      cumT += tk;
      timeseries.push({
        ts: startTs + (i + 1) * CALIBRATION.SNAPSHOT_STEP_SECONDS,
        vault: cumV,
        directLp: cumL,
        taker: cumT,
        total: cumV + cumL + cumT,
        rawTotal: rawCum,
      });
    }

    const effBreakdown: Breakdown = {
      vault: cumV,
      directLp: cumL,
      taker: cumT,
    };

    return {
      user: u.id,
      total: cumV + cumL + cumT,
      rawTotal,
      breakdown: effBreakdown,
      rawBreakdown,
      timeseries,
      positions: positionContribs.get(u.id) ?? [],
    };
  });

  // Stable descending sort by total points.
  scores.sort((a, b) => b.total - a.total);

  return { startTs, endTs, scores };
}

// ────────────────────────────────────────────────────────────────────────────

interface WalkerState {
  vaultBalance: Map<UserId, number>;
  openLP: Map<PositionId, PositionAccrual>;
  openTaker: Map<PositionId, PositionAccrual>;
  positions: Map<PositionId, PositionAccrual>;
  hourCount: number;
}

function applyUserEvent(ev: UserEvent, s: WalkerState): void {
  switch (ev.kind) {
    case 'VAULT_DEPOSIT': {
      s.vaultBalance.set(ev.user, (s.vaultBalance.get(ev.user) ?? 0) + ev.amountUsd);
      return;
    }
    case 'VAULT_WITHDRAW': {
      const cur = s.vaultBalance.get(ev.user) ?? 0;
      s.vaultBalance.set(ev.user, Math.max(0, cur - ev.amountUsd));
      return;
    }
    case 'LP_OPEN': {
      const p: PositionAccrual = {
        user: ev.user,
        positionId: ev.positionId,
        kind: 'LP',
        pair: ev.pair,
        notionalUsd: ev.notionalUsd,
        rangeLowerPx: ev.rangeLowerPx,
        rangeUpperPx: ev.rangeUpperPx,
        openTs: ev.ts,
        closedAt: null,
        hourly: Array.from({ length: s.hourCount }, () => 0),
        total: 0,
      };
      s.positions.set(ev.positionId, p);
      s.openLP.set(ev.positionId, p);
      return;
    }
    case 'LP_CLOSE': {
      const p = s.openLP.get(ev.positionId);
      if (!p) return;
      p.closedAt = ev.ts;
      s.openLP.delete(ev.positionId);
      return;
    }
    case 'TAKER_OPEN': {
      const p: PositionAccrual = {
        user: ev.user,
        positionId: ev.positionId,
        kind: 'TAKER',
        pair: ev.pair,
        notionalUsd: ev.notionalUsd,
        side: ev.side,
        openTs: ev.ts,
        closedAt: null,
        hourly: Array.from({ length: s.hourCount }, () => 0),
        total: 0,
      };
      s.positions.set(ev.positionId, p);
      s.openTaker.set(ev.positionId, p);
      return;
    }
    case 'TAKER_CLOSE': {
      const p = s.openTaker.get(ev.positionId);
      if (!p) return;
      p.closedAt = ev.ts;
      s.openTaker.delete(ev.positionId);
      return;
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sum(arr: readonly number[]): number {
  let s = 0;
  for (const n of arr) s += n;
  return s;
}

function saturate(x: number, x0: number): number {
  if (x <= 0) return 0;
  return x0 * (1 - Math.exp(-x / x0));
}
