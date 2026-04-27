// Deterministic price + funding path for each pair.
//
// - GBM log-return increments per step with mild drift.
// - One engineered high-volatility day near the middle of the run to stress
//   in-range / out-of-range transitions and produce a funding-rate spike.
// - Funding rate has a small baseline (interest-like) plus a term that scales
//   with recent momentum. Loosely mirrors ρ_t = k·(F_t−S_t) + i·S_t from the
//   background material: i is the baseline; k·(F_t−S_t) is proxied by
//   short-window momentum since we don't simulate a separate perp price.

import type { Pair, PriceTick, Timestamp } from '@hyperunicorn/core';
import { SECONDS } from '@hyperunicorn/core';
import type { Rng } from './rng.js';

const STEP_SECONDS = 10 * SECONDS.MINUTE;
const MOMENTUM_WINDOW_STEPS = 6 * 6; // 6h
const FUNDING_BASELINE_ANNUAL = 0.05; // 5% annualized
const FUNDING_MOMENTUM_GAIN = 4; // window-return → annualized rate

export interface PairCfg {
  pair: Pair;
  initialPrice: number;
  driftPerDay: number;
  volPerDay: number;
}

export const PAIR_CONFIGS: PairCfg[] = [
  { pair: 'ETH/USDC', initialPrice: 2_000, driftPerDay: 0.0025, volPerDay: 0.04 },
  { pair: 'WBTC/USDC', initialPrice: 40_000, driftPerDay: 0.0015, volPerDay: 0.028 },
];

export function generatePricePath(
  cfg: PairCfg,
  startTs: Timestamp,
  endTs: Timestamp,
  rng: Rng,
): PriceTick[] {
  const ticks: PriceTick[] = [];
  const dt = STEP_SECONDS / SECONDS.DAY;
  const drift = cfg.driftPerDay * dt;
  const volStep = cfg.volPerDay * Math.sqrt(dt);

  // High-vol window: a 24h block centred around the middle of the run.
  const windowDays = (endTs - startTs) / SECONDS.DAY;
  const stressStart = startTs + (windowDays / 2) * SECONDS.DAY - SECONDS.DAY / 2;
  const stressEnd = stressStart + SECONDS.DAY;

  let price = cfg.initialPrice;
  const recent: number[] = [];

  for (let ts = startTs; ts <= endTs; ts += STEP_SECONDS) {
    const inStress = ts >= stressStart && ts <= stressEnd;
    const volMult = inStress ? 3.5 : 1;

    const logReturn = drift + volStep * volMult * rng.normal(0, 1);
    price *= Math.exp(logReturn);

    recent.push(logReturn);
    if (recent.length > MOMENTUM_WINDOW_STEPS) recent.shift();

    const windowReturn = recent.reduce((s, r) => s + r, 0);
    const annualizedRate = FUNDING_BASELINE_ANNUAL + FUNDING_MOMENTUM_GAIN * windowReturn;
    const fundingRate = annualizedRate / (365 * SECONDS.DAY);

    ticks.push({ ts, pair: cfg.pair, price, fundingRate });
  }

  return ticks;
}
