import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { formatValue } from '../../lib/format.ts';

export interface ChartPoint {
  /** epoch ms */
  x: number;
  y: number | null;
  label: string;
}

export interface ReferenceLine {
  value: number;
  label: string;
}

export interface ReferenceBand {
  from: number;
  to: number;
  label: string;
}

interface Props {
  points: ChartPoint[];
  unit?: string;
  decimals?: number;
  height?: number;
  referenceLines?: ReferenceLine[];
  referenceBand?: ReferenceBand;
  ariaLabel: string;
}

const M = { top: 12, right: 12, bottom: 26, left: 44 };

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(count, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** Linha única (2px), grade discreta, cruz + tooltip ao passar o mouse. */
export function LineChart({ points, unit, decimals = 1, height = 220, referenceLines = [], referenceBand, ariaLabel }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const vals = points.flatMap((p) => (p.y === null ? [] : [p.y]));
    const refs = [
      ...referenceLines.map((r) => r.value),
      ...(referenceBand ? [referenceBand.from, referenceBand.to] : []),
    ];
    let lo = Math.min(...vals, ...refs);
    let hi = Math.max(...vals, ...refs);
    if (!Number.isFinite(lo)) [lo, hi] = [0, 1];
    if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
    const tickCount = height < 180 ? 3 : 4;
    const step = niceStep(hi - lo, tickCount);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hi / step) * step;
    const yTicks: number[] = [];
    for (let v = y0; v <= y1 + step / 2; v += step) yTicks.push(Number(v.toFixed(10)));

    const x0 = points[0]?.x ?? 0;
    const x1 = points[points.length - 1]?.x ?? 1;
    const iw = width - M.left - M.right;
    const ih = height - M.top - M.bottom;
    const sx = (x: number) => M.left + ((x - x0) / Math.max(x1 - x0, 1)) * iw;
    const sy = (y: number) => M.top + (1 - (y - y0) / (y1 - y0)) * ih;

    // Quebra a linha onde não há valor
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.y === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      pen = true;
    }

    // Marcas do eixo x: anos, espaçados para caber
    const startYear = new Date(x0).getFullYear() + 1;
    const endYear = new Date(x1).getFullYear();
    const maxTicks = Math.max(2, Math.floor(iw / 70));
    const yearStep = Math.max(1, Math.ceil((endYear - startYear + 1) / maxTicks));
    const xTicks: { x: number; label: string }[] = [];
    for (let y = startYear; y <= endYear; y += yearStep) xTicks.push({ x: sx(new Date(y, 0, 1).getTime()), label: String(y) });

    return { d, sx, sy, yTicks, xTicks, iw, ih };
  }, [points, width, height, referenceLines, referenceBand]);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + M.left;
    let best = -1;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      if (p.y === null) return;
      const dist = Math.abs(geo.sx(p.x) - px);
      if (dist < bestDist) [best, bestDist] = [i, dist];
    });
    setHover(best >= 0 ? best : null);
  };

  const hp = hover !== null ? points[hover] : undefined;

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {referenceBand && (
          <g>
            <rect
              x={M.left}
              width={geo.iw}
              y={geo.sy(referenceBand.to)}
              height={Math.max(0, geo.sy(referenceBand.from) - geo.sy(referenceBand.to))}
              fill="var(--band)"
            />
          </g>
        )}
        {geo.yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={geo.sy(t)} y2={geo.sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text className="tick" x={M.left - 8} y={geo.sy(t)} dy="0.32em" textAnchor="end">
              {formatValue(t, undefined, Number.isInteger(t) ? 0 : decimals)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((t) => (
          <text key={t.label} className="tick" x={t.x} y={height - 6} textAnchor="middle">
            {t.label}
          </text>
        ))}
        {referenceLines.map((r) => (
          <g key={r.label}>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={geo.sy(r.value)}
              y2={geo.sy(r.value)}
              stroke="var(--ref)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text className="ref-label" x={width - M.right} y={geo.sy(r.value) - 5} textAnchor="end">
              {r.label}
            </text>
          </g>
        ))}
        <path d={geo.d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hp && hp.y !== null && (
          <g pointerEvents="none">
            <line x1={geo.sx(hp.x)} x2={geo.sx(hp.x)} y1={M.top} y2={height - M.bottom} stroke="var(--text-muted)" strokeWidth={1} />
            <circle cx={geo.sx(hp.x)} cy={geo.sy(hp.y)} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={geo.iw}
          height={geo.ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && hp.y !== null && (
        <div className="tooltip" style={{ left: geo.sx(hp.x), top: geo.sy(hp.y) }}>
          <strong>{formatValue(hp.y, unit, decimals)}</strong>
          {hp.label}
        </div>
      )}
    </div>
  );
}
