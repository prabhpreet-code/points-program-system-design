import { describe, it, expect } from 'vitest';
import { computeScores } from './scorer.js';
import { CALIBRATION, SECONDS } from './calibration.js';
import type { EventStream, PriceTick, UserEvent, UserProfile } from './types.js';

// Small helper that pins the sparsest possible stream for each assertion.

const alice: UserProfile = { id: 'alice', label: 'Alice', archetype: 'STEADY_VAULT' };
const bob: UserProfile = { id: 'bob', label: 'Bob', archetype: 'ACTIVE_LP' };

function stream(opts: {
  users?: UserProfile[];
  events?: UserEvent[];
  prices?: PriceTick[];
  startTs?: number;
  endTs?: number;
}): EventStream {
  return {
    users: opts.users ?? [alice],
    events: opts.events ?? [],
    prices: opts.prices ?? [
      { ts: 0, pair: 'ETH/USDC', price: 2000, fundingRate: 0 },
    ],
    startTs: opts.startTs ?? 0,
    endTs: opts.endTs ?? SECONDS.DAY,
  };
}

function scoreOf(id: string, out: ReturnType<typeof computeScores>) {
  const s = out.scores.find((x) => x.user === id);
  if (!s) throw new Error(`user ${id} not in output`);
  return s;
}

describe('calibration', () => {
  it('1000 USD in vault for 1 day → 10 raw points', () => {
    const out = computeScores(
      stream({
        events: [{ kind: 'VAULT_DEPOSIT', ts: 0, user: 'alice', amountUsd: 1000 }],
      }),
    );
    expect(scoreOf('alice', out).rawTotal).toBeCloseTo(10, 2);
    expect(scoreOf('alice', out).timeseries.at(-1)?.rawTotal).toBeCloseTo(10, 2);
  });

  it('1000 USD in-range LP for 1 day → 10 raw points', () => {
    const out = computeScores(
      stream({
        events: [
          {
            kind: 'LP_OPEN',
            ts: 0,
            user: 'alice',
            positionId: 'p1',
            pair: 'ETH/USDC',
            notionalUsd: 1000,
            rangeLowerPx: 1900,
            rangeUpperPx: 2100,
          },
        ],
      }),
    );
    expect(scoreOf('alice', out).rawTotal).toBeCloseTo(10, 2);
  });

  it('taker paying 1 USD of funding → 10 raw points', () => {
    // Funding rate tuned to produce exactly 1 USD of funding paid over the run.
    // payRate = notional · fundingRate = 1000 · 1/1000/DAY = 1/DAY USD/s
    // Total paid over 1 day = 1 USD → points = k_T · 1 = 10.
    const fr = 1 / (1000 * SECONDS.DAY);
    const out = computeScores(
      stream({
        events: [
          {
            kind: 'TAKER_OPEN',
            ts: 0,
            user: 'alice',
            positionId: 't1',
            pair: 'ETH/USDC',
            side: 'LONG',
            notionalUsd: 1000,
          },
        ],
        prices: [{ ts: 0, pair: 'ETH/USDC', price: 2000, fundingRate: fr }],
      }),
    );
    expect(scoreOf('alice', out).rawTotal).toBeCloseTo(10, 2);
  });
});

describe('range status', () => {
  it('out-of-range LP earns S_OUT fraction of in-range', () => {
    const out = computeScores(
      stream({
        events: [
          {
            kind: 'LP_OPEN',
            ts: 0,
            user: 'alice',
            positionId: 'p1',
            pair: 'ETH/USDC',
            notionalUsd: 1000,
            rangeLowerPx: 3000,
            rangeUpperPx: 3500,
          },
        ],
        prices: [{ ts: 0, pair: 'ETH/USDC', price: 2000, fundingRate: 0 }],
      }),
    );
    expect(scoreOf('alice', out).rawTotal).toBeCloseTo(10 * CALIBRATION.S_OUT, 2);
  });

  it('LP accrual tracks intraday range transitions (in 6h → out 6h → in 12h)', () => {
    // 24h run. Position is in range for 6h, out for 6h, in for 12h.
    // Expected raw = 10 · (18/24 · 1.0 + 6/24 · 0.25) = 10 · 0.8125 = 8.125
    const out = computeScores({
      users: [alice],
      events: [
        {
          kind: 'LP_OPEN',
          ts: 0,
          user: 'alice',
          positionId: 'p1',
          pair: 'ETH/USDC',
          notionalUsd: 1000,
          rangeLowerPx: 1900,
          rangeUpperPx: 2100,
        },
      ],
      prices: [
        { ts: 0,                      pair: 'ETH/USDC', price: 2000, fundingRate: 0 }, // in
        { ts: 6 * SECONDS.HOUR,       pair: 'ETH/USDC', price: 2200, fundingRate: 0 }, // out (above)
        { ts: 12 * SECONDS.HOUR,      pair: 'ETH/USDC', price: 2000, fundingRate: 0 }, // in again
      ],
      startTs: 0,
      endTs: SECONDS.DAY,
    });
    const s = scoreOf('alice', out);
    const expected =
      10 *
      ((18 / 24) * CALIBRATION.S_IN + (6 / 24) * CALIBRATION.S_OUT);
    expect(s.rawBreakdown.directLp).toBeCloseTo(expected, 2);
    expect(s.rawBreakdown.vault).toBe(0);
    expect(s.rawBreakdown.taker).toBe(0);
    expect(s.positions[0]!.eligible).toBe(true);
  });
});

describe('anti-abuse', () => {
  it('flash LP position (< min duration) accrues zero', () => {
    const flashDuration = CALIBRATION.MIN_DURATION_SECONDS - 60;
    const out = computeScores(
      stream({
        events: [
          {
            kind: 'LP_OPEN',
            ts: 0,
            user: 'alice',
            positionId: 'p1',
            pair: 'ETH/USDC',
            notionalUsd: 100_000, // huge, to make the farming attempt obvious
            rangeLowerPx: 1900,
            rangeUpperPx: 2100,
          },
          { kind: 'LP_CLOSE', ts: flashDuration, user: 'alice', positionId: 'p1' },
        ],
      }),
    );
    const s = scoreOf('alice', out);
    expect(s.total).toBe(0);
    expect(s.positions[0]!.eligible).toBe(false);
  });

  it('dust LP (< min notional) accrues zero', () => {
    const out = computeScores(
      stream({
        events: [
          {
            kind: 'LP_OPEN',
            ts: 0,
            user: 'alice',
            positionId: 'p1',
            pair: 'ETH/USDC',
            notionalUsd: CALIBRATION.MIN_NOTIONAL_USD - 1,
            rangeLowerPx: 1900,
            rangeUpperPx: 2100,
          },
        ],
      }),
    );
    const s = scoreOf('alice', out);
    expect(s.total).toBe(0);
    expect(s.positions[0]!.eligible).toBe(false);
  });

  it('whale capital saturates: 100× notional earns far less than 100× points', () => {
    const days = 1;
    const makeUser = (id: string, amt: number): EventStream =>
      stream({
        users: [{ id, label: id, archetype: 'WHALE_VAULT' }],
        events: [{ kind: 'VAULT_DEPOSIT', ts: 0, user: id, amountUsd: amt }],
        endTs: SECONDS.DAY * days,
      });

    const small = scoreOf('u', computeScores(makeUser('u', 1_000)));
    const whale = scoreOf('u', computeScores(makeUser('u', 100_000)));
    // Without saturation, whale/small would be exactly 100. With saturation at
    // X0=500/day, 100× the raw points should collapse toward X0.
    const ratio = whale.total / small.total;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(60); // far below 100
  });
});

describe('ranking', () => {
  it('active LP with real duration beats flash farmer with equal notional', () => {
    const notional = 10_000;
    const out = computeScores({
      users: [alice, bob],
      events: [
        // Alice: flashes in and out
        {
          kind: 'LP_OPEN',
          ts: 0,
          user: 'alice',
          positionId: 'a1',
          pair: 'ETH/USDC',
          notionalUsd: notional,
          rangeLowerPx: 1900,
          rangeUpperPx: 2100,
        },
        {
          kind: 'LP_CLOSE',
          ts: CALIBRATION.MIN_DURATION_SECONDS - 60,
          user: 'alice',
          positionId: 'a1',
        },
        // Bob: holds for the full window
        {
          kind: 'LP_OPEN',
          ts: 0,
          user: 'bob',
          positionId: 'b1',
          pair: 'ETH/USDC',
          notionalUsd: notional,
          rangeLowerPx: 1900,
          rangeUpperPx: 2100,
        },
      ],
      prices: [{ ts: 0, pair: 'ETH/USDC', price: 2000, fundingRate: 0 }],
      startTs: 0,
      endTs: SECONDS.DAY,
    });
    const a = scoreOf('alice', out);
    const b = scoreOf('bob', out);
    expect(a.total).toBe(0);
    expect(b.total).toBeGreaterThan(0);
  });
});
