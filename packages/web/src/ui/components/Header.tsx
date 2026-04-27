import { scores } from '../lib/data';
import { formatDate, formatPoints } from '../lib/format';
import { navigate } from '../lib/router';

export function Header() {
  const totalPoints = scores.scores.reduce((s, u) => s + u.total, 0);
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-4">
        <button
          type="button"
          onClick={() => navigate({ page: 'leaderboard' })}
          className="group flex items-center gap-3 text-left"
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <div className="h-4 w-4 rounded-full border border-accent" />
          </div>
          <div className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink">
            HyperUnicorn
            <span className="ml-2 text-ink-faint">·</span>
            <span className="ml-2 text-ink-muted">Points</span>
          </div>
        </button>

        <div className="flex items-center gap-10 font-mono text-[11px]">
          <Metric
            label="Window"
            value={`${formatDate(scores.startTs)} → ${formatDate(scores.endTs)}`}
          />
          <Metric label="Users" value={String(scores.scores.length)} />
          <Metric label="Points" value={formatPoints(totalPoints)} accent />
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="text-3xs font-medium uppercase tracking-widest text-ink-faint">
        {label}
      </div>
      <div
        className={`nums text-sm font-medium ${accent ? 'text-accent' : 'text-ink'}`}
      >
        {value}
      </div>
    </div>
  );
}
