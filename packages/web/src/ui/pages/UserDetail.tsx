import { scores, events, scoreById, userById } from "../lib/data";
import { formatPoints, percent, truncateAddr } from "../lib/format";
import { navigate } from "../lib/router";
import {
  getActivityTypeLabel,
  getDisplayUserLabel,
  getMockScenarioSummary,
  getSignalName,
  getSignalShortLabel,
  getWhyThisScoreLines,
} from "../lib/presentation";
import { AttributionChart } from "../components/AttributionChart";
import { PositionTable } from "../components/PositionTable";
import { MixBar } from "../components/MixBar";

export function UserDetail({ userId }: { userId: string }) {
  const score = scoreById(userId);
  const profile = userById(userId);

  if (!score || !profile) {
    return (
      <div className="mx-auto max-w-[1280px] px-8 py-16">
        <button
          onClick={() => navigate({ page: "leaderboard" })}
          className="font-mono text-xs uppercase tracking-widest text-accent hover:underline"
        >
          ← back
        </button>
        <div className="mt-10 border-y border-line py-12 text-center font-mono text-sm text-ink-muted">
          user <span className="text-ink">{userId}</span> not found.
        </div>
      </div>
    );
  }

  const rank = scores.scores.findIndex((s) => s.user === userId) + 1;
  const savedFromSaturation = score.rawTotal - score.total;
  const absorbedPct =
    score.rawTotal > 0 ? (savedFromSaturation / score.rawTotal) * 100 : 0;
  const eligibleCount = score.positions.filter((p) => p.eligible).length;
  const prunedCount = score.positions.filter((p) => !p.eligible).length;
  const displayLabel = getDisplayUserLabel(profile);
  const activityTypeLabel = getActivityTypeLabel(profile.archetype);
  const mockScenarioSummary = getMockScenarioSummary(profile.archetype);
  const whyThisScoreLines = getWhyThisScoreLines(profile, score);

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <button
        onClick={() => navigate({ page: "leaderboard" })}
        className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
      >
        ← leaderboard
      </button>

      <div className="mt-6 flex items-end justify-between gap-8 border-b border-line pb-8">
        <div>
          <div className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
            {activityTypeLabel}
          </div>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-tight tracking-tight">
            {displayLabel}
          </h1>
          <div className="mt-2 font-mono text-xs text-ink-muted">
            {truncateAddr(profile.id)}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {mockScenarioSummary}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
            Rank
          </div>
          <div className="nums mt-1 font-mono text-[32px] font-medium leading-none tracking-tight text-ink">
            #{rank}
            <span className="ml-1 font-sans text-sm font-normal text-ink-faint">
              / {scores.scores.length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-line border-b border-line">
        <Stat
          label="Total points"
          value={formatPoints(score.total)}
          sub={`raw ${formatPoints(score.rawTotal)}`}
          accent
        />
        <Stat
          label={getSignalName("vault")}
          value={formatPoints(score.breakdown.vault)}
          sub={percent(score.breakdown.vault, score.total)}
          dotClass="bg-series-vault"
        />
        <Stat
          label={getSignalName("directLp")}
          value={formatPoints(score.breakdown.directLp)}
          sub={percent(score.breakdown.directLp, score.total)}
          dotClass="bg-series-lp"
        />
        <Stat
          label={getSignalName("taker")}
          value={formatPoints(score.breakdown.taker)}
          sub={percent(score.breakdown.taker, score.total)}
          dotClass="bg-series-taker"
        />
      </div>

      <section className="mt-12">
        <SectionHead
          label="02"
          title="Why this score?"
          hint="What this mock scenario is demonstrating and what actually drove the final score"
        />
        <div className="border-y border-line bg-bg-elev px-5 py-5">
          <div className="max-w-3xl space-y-2">
            {whyThisScoreLines.map((line, index) => (
              <p
                key={line}
                className={`text-sm leading-relaxed ${
                  index === 0 ? "text-ink" : "text-ink-muted"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHead
          label="03"
          title="Attribution over time"
          hint="Filled areas show final cumulative points by signal; the dashed line shows raw cumulative points before daily saturation"
        />
        <div className="border-y border-line bg-bg-elev px-4 py-4">
          <AttributionChart series={score.timeseries} />
        </div>
        <div className="mt-3 flex items-center gap-6 font-mono text-2xs text-ink-muted">
          <LegendItem color="bg-series-vault" label="V" name="Vault" />
          <LegendItem color="bg-series-lp" label="D" name="Direct Positions" />
          <LegendItem color="bg-series-taker" label="F" name="Funding Demand" />
          <LegendLineItem label="Raw" name="Pre-saturation total" />
        </div>
      </section>

      <section className="mt-12">
        <SectionHead
          label="04"
          title="Gates applied"
          hint="How raw activity became score"
        />
        <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
          <Aside
            label="Saturation impact"
            primary={formatPoints(savedFromSaturation)}
            sub={
              savedFromSaturation > 0
                ? `${absorbedPct.toFixed(
                    0
                  )}% of raw points reduced by daily saturation`
                : "no daily saturation applied"
            }
            tone={savedFromSaturation > 0 ? "warn" : "neutral"}
          />
          <Aside
            label="Eligible entries"
            primary={`${eligibleCount} / ${score.positions.length}`}
            sub={
              prunedCount > 0
                ? `${prunedCount} pruned by min-duration or min-notional`
                : "all eligible"
            }
          />
          <Aside
            label="Signal mix"
            primary={
              <MixBar breakdown={score.breakdown} width={220} height={5} />
            }
            sub={`${getSignalShortLabel("vault")} ${percent(
              score.breakdown.vault,
              score.total
            )}  ·  ${getSignalShortLabel("directLp")} ${percent(
              score.breakdown.directLp,
              score.total
            )}  ·  ${getSignalShortLabel("taker")} ${percent(
              score.breakdown.taker,
              score.total
            )}`}
          />
        </div>
      </section>

      <section className="mt-12">
        <SectionHead
          label="05"
          title="Positions"
          hint="Direct positions and funding-demand entries · pruned rows earned zero"
        />
        <PositionTable positions={score.positions} endTs={events.endTs} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  dotClass,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  dotClass?: string;
}) {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-1.5">
        {dotClass ? <div className={`h-1.5 w-1.5 ${dotClass}`} /> : null}
        <div className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
          {label}
        </div>
      </div>
      <div
        className={`nums mt-2 text-2xl font-medium tracking-tight ${
          accent ? "text-ink" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="nums mt-1 font-mono text-2xs text-ink-muted">{sub}</div>
      {accent ? <div className="mt-3 h-px w-8 bg-accent" /> : null}
    </div>
  );
}

function SectionHead({
  label,
  title,
  hint,
}: {
  label: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-3xs font-medium text-ink-faint">
          {label}
        </span>
        <h2 className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      <p className="font-mono text-2xs text-ink-muted">{hint}</p>
    </div>
  );
}

function Aside({
  label,
  primary,
  sub,
  tone,
}: {
  label: string;
  primary: React.ReactNode;
  sub: string;
  tone?: "warn" | "neutral";
}) {
  return (
    <div className="px-5 py-5">
      <div className="font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
        {label}
      </div>
      <div
        className={[
          "nums mt-2 text-xl font-medium",
          tone === "warn" ? "text-warn" : "text-ink",
        ].join(" ")}
      >
        {primary}
      </div>
      <div className="mt-1.5 font-mono text-2xs leading-snug text-ink-muted">
        {sub}
      </div>
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
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 ${color}`} />
      <span className="text-ink">{label}</span>
      <span className="text-ink-faint">{name}</span>
    </div>
  );
}

function LegendLineItem({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="h-px w-5 border-t border-dashed border-[#F97316]" />
        <span>{label}</span>
      </div>
      <span className="text-ink-faint">{name}</span>
    </div>
  );
}
