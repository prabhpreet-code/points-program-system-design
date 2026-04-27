import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HourlyPoint } from '@hyperunicorn/core';
import { formatDate, formatPoints } from '../lib/format';
import { getSignalName } from '../lib/presentation';

export function AttributionChart({ series }: { series: HourlyPoint[] }) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        ts: p.ts,
        [getSignalName('vault')]: p.vault,
        [getSignalName('directLp')]: p.directLp,
        [getSignalName('taker')]: p.taker,
        'Raw Total': p.rawTotal,
      })),
    [series],
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <defs>
            <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="gradL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0B455" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#E0B455" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="gradT" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7DD3FC" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#7DD3FC" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#1C1C21"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => formatDate(v).slice(5)}
            stroke="#52525A"
            fontSize={10}
            fontFamily="'JetBrains Mono', monospace"
            tickLine={false}
            axisLine={{ stroke: '#1C1C21' }}
            minTickGap={40}
          />
          <YAxis
            stroke="#52525A"
            fontSize={10}
            fontFamily="'JetBrains Mono', monospace"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatPoints(v)}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: '#27272C', strokeWidth: 1 }}
            contentStyle={{
              background: '#0E0E10',
              border: '1px solid #27272C',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              padding: '8px 10px',
              boxShadow: 'none',
            }}
            labelStyle={{
              color: '#8E8E95',
              marginBottom: 6,
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
            itemStyle={{ color: '#EDEDEF', padding: '1px 0' }}
            labelFormatter={(v) => formatDate(v as number)}
            formatter={(v: number, name) => [formatPoints(v), name]}
          />
          <Area
            type="monotone"
            dataKey={getSignalName('vault')}
            stackId="1"
            stroke="#A78BFA"
            strokeWidth={1}
            fill="url(#gradV)"
          />
          <Area
            type="monotone"
            dataKey={getSignalName('directLp')}
            stackId="1"
            stroke="#E0B455"
            strokeWidth={1}
            fill="url(#gradL)"
          />
          <Area
            type="monotone"
            dataKey={getSignalName('taker')}
            stackId="1"
            stroke="#7DD3FC"
            strokeWidth={1}
            fill="url(#gradT)"
          />
          <Line
            type="monotone"
            dataKey="Raw Total"
            stroke="#F97316"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
