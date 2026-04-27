// All tunable constants in one place. No magic numbers elsewhere in the scorer.
//
// Calibration targets (see docs/POINTS_SPEC.md § Calibration):
//   • 1,000 USD in vault for 1 day      → 10 points
//   • 1,000 USD LP in-range for 1 day   → 10 points
//   • 1 USD of funding paid             → 10 points

const SECONDS_PER_DAY = 24 * 60 * 60;

export const CALIBRATION = {
  // points per (USD · second) held in vault
  k_V: 10 / (1_000 * SECONDS_PER_DAY),

  // points per (USD · second) held in an in-range LP
  k_L: 10 / (1_000 * SECONDS_PER_DAY),

  // points per USD of funding paid (dimensionless — funding is already in USD)
  k_T: 10,

  // Range status factor
  S_IN: 1.0,
  S_OUT: 0.25,

  // Anti-abuse
  MIN_DURATION_SECONDS: 4 * 60 * 60, // 4h — positions closed before this accrue nothing
  MIN_NOTIONAL_USD: 50, // positions below this notional are ignored

  // Per-user, per-24h saturation:  effective = X0 · (1 − exp(−raw / X0))
  // Picked so that a single user can score up to ~X0 points/day linearly, with
  // diminishing returns above that. Matches ~X0 USD·days of honest supply/day.
  SATURATION_X0_PER_DAY: 500,

  // Hourly snapshot cadence for the timeseries — rendering, not scoring
  SNAPSHOT_STEP_SECONDS: 60 * 60,
} as const;

export const SECONDS = {
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: SECONDS_PER_DAY,
} as const;
