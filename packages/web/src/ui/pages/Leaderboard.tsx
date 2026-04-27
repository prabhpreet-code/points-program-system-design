import { scores, events } from '../lib/data';
import { formatPoints, truncateAddr } from '../lib/format';
import { navigate } from '../lib/router';
import {
  getActivityTypeLabel,
  getDisplayUserLabel,
  getMockScenarioSummary,
} from '../lib/presentation';
import { Sparkline } from '../components/Sparkline';
import { MixBar } from '../components/MixBar';

export function Leaderboard() {
  const rows = scores.scores.map((s, i) => {
    const profile = events.users.find((u) => u.id === s.user);
    return {
      rank: i + 1,
      id: s.user,
      label: profile ? getDisplayUserLabel(profile) : s.user,
      activityType: profile ? getActivityTypeLabel(profile.archetype) : '—',
      scenarioSummary: profile ? getMockScenarioSummary(profile.archetype) : '',
      total: s.total,
      rawTotal: s.rawTotal,
      breakdown: s.breakdown,
      timeseries: s.timeseries.map((p) => p.total),
    };
  });

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
            /  Leaderboard
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight">
            Cumulative points across the 30-day window
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
            Points reward sticky vault deposits, useful direct positions, and real
            funding demand. Click any row to see how raw activity became final score.
          </p>
        </div>
        <LegendInline />
      </div>

      <div className="-mx-4 overflow-x-auto border-t border-line">
        <div className="min-w-[880px] px-4">
          <div className="grid grid-cols-[32px_minmax(180px,1fr)_90px_80px_80px_96px_120px] items-center gap-4 border-b border-line py-3 font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
            <div>#</div>
            <div>User</div>
            <div className="text-right">Points</div>
            <div className="text-right">Raw</div>
            <div className="text-right">Saturation</div>
            <div className="text-center">Mix</div>
            <div className="text-right">30d</div>
          </div>
          {rows.map((r) => {
          const absorbed = r.rawTotal - r.total;
          const absorbedPct = r.rawTotal > 0 ? absorbed / r.rawTotal : 0;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate({ page: 'user', userId: r.id })}
              title={r.scenarioSummary}
              className="group grid w-full grid-cols-[32px_minmax(180px,1fr)_90px_80px_80px_96px_120px] items-center gap-4 border-b border-line py-4 text-left transition-colors hover:bg-bg-sub"
            >
              <div className="font-mono text-sm text-ink-faint">
                {r.rank.toString().padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">
                  {r.label}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint">
                  <span className="font-mono">{truncateAddr(r.id)}</span>
                  <span className="text-ink-ghost">·</span>
                  <span className="uppercase tracking-wider">{r.activityType}</span>
                </div>
              </div>
              <div className="nums text-right text-[15px] font-medium text-ink">
                {formatPoints(r.total)}
              </div>
              <div className="nums text-right font-mono text-[13px] text-ink-muted">
                {formatPoints(r.rawTotal)}
              </div>
              <div className="nums text-right font-mono text-[13px]">
                {absorbed > 0 ? (
                  <span className="text-warn">
                    −{Math.round(absorbedPct * 100)}%
                  </span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </div>
              <div className="flex justify-center">
                <MixBar breakdown={r.breakdown} />
              </div>
              <div className="flex justify-end">
                <Sparkline values={r.timeseries} width={108} />
              </div>
            </button>
          );
        })}
        </div>
      </div>

      <RulesStrip />
    </div>
  );
}

function LegendInline() {
  return (
    <div className="flex shrink-0 items-center gap-4 font-mono text-2xs">
      <LegendItem color="bg-series-vault" label="V" name="Vault" />
      <LegendItem color="bg-series-lp" label="D" name="Direct Positions" />
      <LegendItem color="bg-series-taker" label="F" name="Funding Demand" />
    </div>
  );
}

function LegendItem({
  color,
  label,
  name,
}: {
  color: string;
  label: string;
  name: string;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <div className={`h-1.5 w-1.5 ${color}`} />
      <span className="text-ink">{label}</span>
      <span className="text-ink-faint">{name}</span>
    </div>
  );
}

function RulesStrip() {
  const rules: Array<{ n: string; k: string; v: string }> = [
    { n: '01', k: 'Min direct-position duration', v: '4h' },
    { n: '02', k: 'Min notional', v: '$50' },
    { n: '03', k: 'No event-count rewards', v: '—' },
    { n: '04', k: 'Out-of-range direct-position factor', v: '0.25×' },
    { n: '05', k: 'Per-user 24h saturation', v: 'X₀=500' },
  ];
  return (
    <div className="mt-10">
      <div className="mb-3 font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
        /  Anti-abuse levers
      </div>
      <div className="grid grid-cols-5 gap-px bg-line">
        {rules.map((r) => (
          <div key={r.n} className="bg-bg px-4 py-3">
            <div className="font-mono text-3xs text-ink-faint">{r.n}</div>
            <div className="mt-1 text-[13px] text-ink">{r.k}</div>
            <div className="mt-0.5 font-mono text-xs text-accent">{r.v}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
        Per-user saturation reduces whale dominance and single-wallet burst farming,
        but it does not fully solve Sybil splitting.
      </p>
    </div>
  );
}
