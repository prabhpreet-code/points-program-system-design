# HyperUnicorn Points program

## Goal

We need to design a points mechanism that incentivizes meaningful participation and boosts sticky liquidity and activity. Naturally, farmers will try to exploit the system. So designing a points system is more or less a 1v1 battle against these farming patterns. Interesting problem to solve for sure.

When designing this system, the two most important things to think about are:

1. **Payouts** — How are we going to distribute the finalized rewards? _(Out of scope for this assessment but imp)_
2. **Accruals** — How do we calculate and accrue points for users? _(The focus of this spec)_

While we want to incentivize users generously, our priority must **always & always** be the health of the protocol.

---

## How to Decide Whom to Award?

HyperUnicorn has two user-facing activity types:

1. **Vault activity** — Users deposit into a vault that manages LP-based positions on their behalf.
2. **Direct activity** — Advanced users create and manage their own custom LP-based positions.

For scoring, these activities decompose into three economic signals:

1. Vault-managed capital
2. Direct position capital
3. Funding / demand contribution

### What's Actually Beneficial for the Protocol?

- **Productive and sticky capital:** Capital committed × time × whether the capital is currently productive. Vault users and direct LPs both contribute here; the scoring just differs in how "productive" is measured.
- **Demand and interaction:** Funding paid per unit time. More trades equal more capital utilization. Interestingly, funding paid is a highly abuse-resistant signal because a user has to pay real money to earn it. But in some cases it might not be the best — more on this in the Improvements section.

A points system anchored on these two primitives rewards the behaviors the protocol actually wants (liquidity provision + real usage) and makes adversarial behaviors (flash loans, dust spamming, wash trading) economically uninteresting.

---

## When to Calculate Points?

The first approach that comes to mind is snapshotting: Weekly?? Hourly?? Daily??? The problem is that **fixed snapshots are incredibly inefficient**. Farmers will figure out the exact snapshot time and flash-deposit capital right before it. Sure, we could randomize snapshot times, but that doesn't scale well and creates a terrible, unpredictable UX for honest sweet users waiting to see their points.

### The Solution: Orthogonal Layers

1. **Scoring (Continuous):** Event / price-tick based. The engine calculates points continuously between events:

   `points += rate(t) * dt`

   No buckets, no midnight snapshots.

2. **Display:** We bundle the continuous data into hourly UI charts. Continuous counters (like Lulo Fi's) keep users hooked and deliver dopamine, waoo it's so cool... Also, separating display from scoring gives the freedom to build whatever UI we want without breaking the math.

### Saturation (The Rate Limiter)

It's a trade-off honestly. We run a saturation curve over a user's accrued points in fixed **24h buckets**. This ensures fair distribution for smaller users, but it can feel a bit unfair to massive whales. Adding this strictness also invites multi-wallet sybil farming. Ultimately, it forces a protocol-level decision: **do we optimize for more unique users or more raw volume??**

---

## Scoring Model

State is piecewise-constant between user actions and price/funding updates, so the integral collapses into a sum of `rate * dt` slices.

```txt
rate(u, t) = V(u, t) + D(u, t) + F(u, t)
```

| Term  | Formula                                                             | Description                   |
| ----- | ------------------------------------------------------------------- | ----------------------------- |
| **V** | `k_V * vault_balance_usd(u, t)`                                     | Vault-managed capital         |
| **D** | `k_D * Σ notional(p, t) * S(p, t)`                                  | Direct position capital       |
| **F** | `k_F * max(funding_paid_rate(u, t), 0)`                             | Funding / demand contribution |

```txt
Points(u, [t0, t1]) = integral of rate(u, s) ds
```

### Variable Definitions

| Variable                           | Definition                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `vault_balance_usd(u, t)`          | USD value of the user's share of the managed vault                                                            |
| `notional(p, t)`                   | USD value of direct position `p` — held constant from `POSITION_OPEN` (see Improvements for Mark-to-Market) |
| `S(p, t)`                          | Productivity factor: **1.0** if in-range, **0.25** if out-of-range                                            |
| `funding_paid_rate(u, t)`          | USD/second the user is paying; capped at `0` via `max()` so users _receiving_ funding don't lose points      |

### Events That Change the Rate

The scorer maintains a merged, time-ordered stream of:

- **User actions:** `VAULT_DEPOSIT`, `VAULT_WITHDRAW`, `POSITION_OPEN`, `POSITION_CLOSE`
- **Price events:** Updates that change whether a direct position is in-range or out-of-range
- **Funding events:** Updates that change the demand-side payment rate

### Calibration

Constants are chosen so that equal capital and average market conditions produce comparable points across roles:

| Constant | Target                                                           |
| -------- | ---------------------------------------------------------------- |
| `k_V`    | \$1,000 in the vault for 1 day ≈ **10 points**                   |
| `k_D`    | \$1,000 in a medium-width, in-range LP for 1 day ≈ **10 points** |
| `k_F`    | A taker earning 10 points has paid ~\$1 in funding               |

---

## Anti-Abuse Levers

Five levers. Each defeats a specific, constructible farming archetype.

| Lever                                 | Defeats                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| **Min position duration (4h)**        | _Flash farmers:_ Direct positions closed before the threshold earn 0 points     |
| **Min notional (\$50)**               | _Dust spammers:_ Eliminates thousands of \$1 positions gaming metrics           |
| **No event-count rewards**            | _Wash churn:_ Repeatedly opening/closing to trigger per-event bonuses           |
| **Out-of-range penalty (`S = 0.25`)** | _Parked-tick farmers:_ Placing LPs on ticks that rarely trade to farm risk-free |
| **Per-user 24h saturation**           | _Whale dominance:_ Caps single-wallet burst farming                             |

> **Note on min position duration:** I personally want to keep it above 4h since sticky TVL matters more and users should leave capital in the protocol for longer.

### Saturation Trade-Off

Per-user saturation gives small-capital users a fair chance and fights single-wallet burst farming. However, it **actively incentivizes whales to split capital across many wallets**. Example:

| Raw Points | Effective Points |
| ---------- | ---------------- |
| 100        | ~95              |
| 1,000      | ~632             |
| 5,000      | ~993             |
| 10,000     | ~1,000           |

A whale could create 100 wallets, deposit 100 each, and net ~9,500 effective points vs. ~1,000 from a single wallet. Mitigations like **IP limits etc** could be useful for sure but it's ultimately a protocol-level trade-off: allow whales their deserved points (leaderboard dominated by capital) or enforce saturation (fairer distribution but sybil-susceptible).

---

## Improvements

### Mark-to-Market LP Valuation

In the current version, direct position notional is held fixed from `POSITION_OPEN` for scorer simplicity. But a Uniswap v3-style LP position changes value as price moves because its token composition shifts between the two assets.

**Current:**

```txt
notional_at_open * S(p, t)
```

**Improved:**

```txt
current_position_value_usd(t) * S(p, t)
```

This makes points more economically accurate during large price moves.

---

### Dynamic Reward Weights

Currently, reward weights are fixed constants. Later, these could become **dynamic governance/configuration parameters**. For example:

- Increase vault rewards when vault liquidity is low
- Increase direct position rewards for under-supplied markets
- Run special marketing campaigns with boosted weights

---

### Beyond Funding Rates

The current demand-side formula:

```txt
F(u, t) = k_F * max(funding_paid_rate(u, t), 0)
```

I chose this because funding paid is a real economic cost and is harder to fake. But at the same time if somebody opened a USD 1M position during times when price is not much deviated and funding rate is minimal, they would pay very little funding and earn very few points, which is not always fair. So that’s why.

**In next version we could include open perp notional and trading fees paid multiplier:**

```
F(u,t) =
  k_OI      · open_notional(u,t)
+ k_fee     · trading_fee_paid_rate(u,t)
+ k_funding · max(funding_paid_rate(u,t), 0)
```

---

### Behavioral Psychology & Game Design

Constant, highly predictable rewards eventually lead to user boredom. I would intentionally tune the baseline emission rate slightly lower to build a "points reserve." The protocol would then use this reserve to deploy spontaneous, unannounced loyalty drops (e.g., "Surprise! 2x Points for all active Vault users this weekend”). This **intermittent reinforcement** i.e unpredictable, generous bonuses create emotional loyalty, making the protocol feel more generous, and highly addictive, rather than strictly transactional.

---

## Frontend Dashboard

The dashboard is intentionally designed to be more explanatory than a real end-user points page and the goal is to illustrate various scenarios and show how the points system works.

### Pages

**Leaderboard**

- Rank, address, archetype
- Total + raw points
- V/D/F mix bar
- 30-day sparkline

**User Detail**

- Rank, stacked-area attribution chart over time
- Explicit saturation impact
- Eligible / pruned position counts
- Position ledger

### How I would build this for Real Users?

Designing points program UX is a psychological game. You don’t wanna give too much of cognitive load to the users. Also we don’t wanna be intentionally be too transparent that we handle a roadmap to mercenary farmers. Instead:

- **Hide the penalties:** Don't show "Raw vs. Saturated" math. Users only see their Effective points to avoid the friction of seeing their score "reduced". Users hate feeling penalized instead give them bonus/surprise points at multiple intervals to keep them happy.
- **Context-aware estimations:** Instead of expecting users to understand the math, we show it at the point of action. For example when a user slides a deposit bar on the vault page, the UI should dynamically estimate: "Depositing this will earn you ~X points ~Y earnings per day at current rates."
- **Actionable insights:** The dashboard should be intuitive, it should be guiding users. I would add a smart optimization widget or “Pro-Tip” tool tips to help users optimise and maximise their earnings and the points at different action steps.

---

## Mock Data

The mock data is intentionally designed to **stress the scoring system** rather than only show happy-path users.

The dataset covers a **30-day window**, two markets (`ETH/USDC` and `WBTC/USDC`), regular price updates, and a **high-volatility period** near the middle of the window. The goal is to show how points evolve across different market conditions, user behaviors, and anti-abuse cases.

### Archetypes

| Archetype               | Behavior                                           | What It Validates               |
| ----------------------- | -------------------------------------------------- | ------------------------------- |
| **Whale vault**         | Large vault depositor                              | Vault scoring and saturation    |
| **Steady vault**        | Smaller but consistent vault depositor             | Sticky passive capital          |
| **Active direct user**  | User-managed direct positions that stay productive | Direct position scoring         |
| **Parked direct user**  | Positions often out of range                       | Out-of-range discount           |
| **Funding-demand user** | Pays funding while holding exposure                | Demand-side scoring             |
| **Hybrid**              | Uses vaults, direct positions, and funding demand  | Balanced healthy behavior       |
| **Flash farmer**        | Large short-lived activity                         | Minimum duration and saturation |
| **Dust spammer**        | Many tiny positions                                | Minimum notional gate           |
| **Newcomer**            | Joins mid-window and ramps up                      | Growth over time                |

### Expected Outcomes by Archetype

- The **flash farmer** shows a sharp burst of raw activity but limited final points
- The **dust spammer** shows many pruned positions
- The **parked direct user** earns less because their capital is not consistently productive
- The **hybrid user** shows a healthier mix across scoring signals

> The mock data is **deterministic** — the same seed always produces the same events and scores, making scoring behavior reproducible and easier to test.

## Run it locally

```bash
pnpm install           # monorepo install
pnpm test              # runs the scorer test suite
pnpm run build:data    # generates events.json + scores.json from seeded mock data
pnpm dev               # starts the dashboard at http://localhost:5173
```

## Repository layout

```
panoptic/
├── README.md                       # this file
├── packages/
│   ├── core/                       # @hyperunicorn/core — types + scorer + tests
│   │   └── src/{types,calibration,scorer,scorer.test}.ts
│   ├── data/                       # @hyperunicorn/data — mock data + CLIs
│   │   ├── src/{rng,pricePath,archetypes,generate,score}.ts
│   │   └── generated/{events,scores}.json
│   └── web/                        # @hyperunicorn/web — the dashboard
│       └── src/ui/{pages,components,lib}/
├── pnpm-workspace.yaml
└── tsconfig.base.json
```
