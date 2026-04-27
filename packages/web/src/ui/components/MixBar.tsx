import type { Breakdown } from '@hyperunicorn/core';
import { getSignalName } from '../lib/presentation';

// Thin, muted horizontal bar showing the V / D / F split.
export function MixBar({
  breakdown,
  width = 84,
  height = 3,
}: {
  breakdown: Breakdown;
  width?: number;
  height?: number;
}) {
  const total = breakdown.vault + breakdown.directLp + breakdown.taker;
  if (total <= 0) {
    return (
      <div
        className="rounded-[1px] bg-line"
        style={{ width, height }}
        aria-label="no points"
      />
    );
  }
  const v = (breakdown.vault / total) * width;
  const l = (breakdown.directLp / total) * width;
  const t = (breakdown.taker / total) * width;
  return (
    <div
      className="flex overflow-hidden rounded-[1px] bg-line"
      style={{ width, height }}
    >
      <div
        style={{ width: v }}
        className="bg-series-vault"
        title={`${getSignalName('vault')} ${pct(breakdown.vault, total)}`}
      />
      <div
        style={{ width: l }}
        className="bg-series-lp"
        title={`${getSignalName('directLp')} ${pct(breakdown.directLp, total)}`}
      />
      <div
        style={{ width: t }}
        className="bg-series-taker"
        title={`${getSignalName('taker')} ${pct(breakdown.taker, total)}`}
      />
    </div>
  );
}

function pct(a: number, b: number) {
  return Math.round((a / b) * 100) + '%';
}
