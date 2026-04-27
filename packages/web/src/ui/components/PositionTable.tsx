import { useState } from 'react';
import type { PositionContribution } from '@hyperunicorn/core';
import { formatDate, formatPoints, formatUsd } from '../lib/format';
import { getPositionKindLabel } from '../lib/presentation';

const COLLAPSE_THRESHOLD = 10;

export function PositionTable({
  positions,
  endTs,
}: {
  positions: PositionContribution[];
  endTs: number;
}) {
  const [showAll, setShowAll] = useState(false);

  if (positions.length === 0) {
    return (
      <div className="border-y border-line bg-bg-elev px-4 py-6 text-sm text-ink-muted">
        No direct positions or funding-demand entries in this window.
      </div>
    );
  }
  const sorted = [...positions].sort((a, b) => b.points - a.points);
  const visible =
    showAll || sorted.length <= COLLAPSE_THRESHOLD
      ? sorted
      : sorted.slice(0, COLLAPSE_THRESHOLD);
  const hidden = sorted.length - visible.length;

  return (
    <div className="border-y border-line">
      <div className="grid grid-cols-[60px_110px_minmax(110px,1fr)_110px_110px_110px_90px] items-center gap-4 border-b border-line bg-bg-elev px-4 py-2.5 font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
        <div>Kind</div>
        <div>Pair</div>
        <div className="text-right">Notional</div>
        <div>Opened</div>
        <div>Closed</div>
        <div className="text-right">Points</div>
        <div className="text-center">Status</div>
      </div>
      <div className="divide-y divide-line">
        {visible.map((p) => {
          const isOpen = p.closedAt === null || p.closedAt === endTs;
          return (
            <div
              key={p.positionId}
              className="grid grid-cols-[60px_110px_minmax(110px,1fr)_110px_110px_110px_90px] items-center gap-4 px-4 py-2.5"
            >
              <div>
                <span
                  className={[
                    'font-mono text-2xs font-medium',
                    p.kind === 'LP' ? 'text-series-lp' : 'text-series-taker',
                  ].join(' ')}
                >
                  {getPositionKindLabel(p.kind)}
                </span>
              </div>
              <div className="font-mono text-xs text-ink-muted">{p.pair}</div>
              <div className="nums text-right font-mono text-[13px] text-ink">
                {formatUsd(p.notionalUsd)}
              </div>
              <div className="font-mono text-xs text-ink-muted">
                {formatDate(p.openedAt)}
              </div>
              <div className="font-mono text-xs text-ink-muted">
                {isOpen ? (
                  <span className="text-positive">open</span>
                ) : (
                  formatDate(p.closedAt!)
                )}
              </div>
              <div
                className={`nums text-right font-mono text-[13px] ${
                  p.points > 0 ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                {formatPoints(p.points)}
              </div>
              <div className="text-center">
                {p.eligible ? (
                  <span className="font-mono text-2xs text-positive">
                    eligible
                  </span>
                ) : (
                  <span className="font-mono text-2xs text-negative">
                    pruned
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line bg-bg-elev px-4 py-2.5 font-mono text-2xs font-medium uppercase tracking-widest text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent"
        >
          Show {hidden} more
        </button>
      ) : null}
    </div>
  );
}
