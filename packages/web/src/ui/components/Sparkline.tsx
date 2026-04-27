import { useMemo } from 'react';

export function Sparkline({
  values,
  width = 120,
  height = 28,
  stroke = '#A78BFA',
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  const { path, lastX, lastY } = useMemo(() => {
    if (values.length === 0) return { path: '', lastX: 0, lastY: 0 };
    const max = Math.max(...values, 1e-9);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const step = values.length > 1 ? width / (values.length - 1) : 0;

    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return [x, y] as const;
    });

    const d = pts
      .map(([x, y], i) =>
        i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`,
      )
      .join(' ');
    const last = pts[pts.length - 1]!;
    return { path: d, lastX: last[0], lastY: last[1] };
  }, [values, width, height]);

  if (!path) return <svg width={width} height={height} />;

  return (
    <svg width={width} height={height} className="block">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={1.8} fill={stroke} />
    </svg>
  );
}
