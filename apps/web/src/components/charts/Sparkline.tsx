/** Mini-tendência sem eixos: só a forma da série, com o ponto atual destacado. */
export function Sparkline({ values, width = 120, height = 36, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 4;
  const sx = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const sy = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="sparkline">
      <path d={d} fill="none" stroke="var(--ref)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(last)} cy={sy(values[last]!)} r={3.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={1.5} />
    </svg>
  );
}
