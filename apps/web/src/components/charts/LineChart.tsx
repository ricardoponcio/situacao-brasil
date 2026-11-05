import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { formatValue } from '../../lib/format.ts';

export interface ChartPoint {
  /** epoch ms */
  x: number;
  y: number | null;
  label: string;
}

/** Uma linha do gráfico. A cor segue a linha (o território), nunca a posição na lista. */
export interface ChartSeries {
  id: string;
  /** Nome no fim da linha e na leitura do mouse */
  label: string;
  color: string;
  points: ChartPoint[];
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
  series: ChartSeries[];
  unit?: string;
  decimals?: number;
  height?: number;
  referenceLines?: ReferenceLine[];
  referenceBand?: ReferenceBand;
  ariaLabel: string;
}

const M = { top: 12, right: 12, bottom: 26, left: 44 };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** Espaço mínimo entre os nomes no fim das linhas */
const LABEL_GAP = 15;

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(count, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Linhas de 2px, grade discreta, cruz + leitura de todas as linhas ao passar o mouse.
 * Com mais de uma linha, cada uma leva o nome no fim (a cor nunca é a única pista).
 */
export function LineChart({ series, unit, decimals = 1, height = 220, referenceLines = [], referenceBand, ariaLabel }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const multi = series.length > 1;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const vals = all.flatMap((p) => (p.y === null ? [] : [p.y]));
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
    // Casas decimais do passo (0,25 → 2), para a marca não aparecer arredondada (5,25 virando 5,3)
    const tickDecimals = Math.max(decimals, String(step).split('.')[1]?.length ?? 0);

    // Nomes no fim das linhas: a margem direita cresce com o nome mais comprido.
    const right = multi ? M.right + 8 + Math.max(...series.map((s) => s.label.length)) * 7.5 : M.right;
    const xs = all.map((p) => p.x);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const iw = width - M.left - right;
    const ih = height - M.top - M.bottom;
    const sx = (x: number) => M.left + ((x - x0) / Math.max(x1 - x0, 1)) * iw;
    const sy = (y: number) => M.top + (1 - (y - y0) / (y1 - y0)) * ih;

    // Quebra a linha onde não há valor
    const paths = series.map((s) => {
      let d = '';
      let pen = false;
      for (const p of s.points) {
        if (p.y === null) {
          pen = false;
          continue;
        }
        d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
        pen = true;
      }
      return d;
    });

    // Rótulos de fim de linha, afastados para não se sobrepor
    const ends = series
      .map((s) => {
        const last = [...s.points].reverse().find((p) => p.y !== null);
        return last ? { id: s.id, label: s.label, y: sy(last.y!), x: sx(last.x) } : null;
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + LABEL_GAP);

    // Marcas do eixo x: meses quando o período é curto, anos quando é longo
    const maxTicks = Math.max(2, Math.floor(iw / 70));
    const xTicks: { x: number; label: string }[] = [];
    const d0 = new Date(x0);
    const d1 = new Date(x1);
    const months = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth();
    if (months <= 24) {
      const mStep = [1, 2, 3, 6, 12].find((m) => months / m <= maxTicks) ?? 12;
      const first = new Date(d0.getFullYear(), d0.getMonth(), 1);
      if (d0.getDate() > 1) first.setMonth(first.getMonth() + 1);
      first.setMonth(Math.ceil(first.getMonth() / mStep) * mStep);
      for (const d = first; d.getTime() <= x1; d.setMonth(d.getMonth() + mStep)) {
        xTicks.push({ x: sx(d.getTime()), label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
      }
    } else {
      const startYear = d0.getFullYear() + (d0.getMonth() > 0 || d0.getDate() > 1 ? 1 : 0);
      const endYear = d1.getFullYear();
      const yearStep = Math.max(1, Math.ceil((endYear - startYear + 1) / maxTicks));
      for (let y = startYear; y <= endYear; y += yearStep) xTicks.push({ x: sx(new Date(y, 0, 1).getTime()), label: String(y) });
    }

    const allX = [...new Set(all.filter((p) => p.y !== null).map((p) => p.x))].sort((a, b) => a - b);
    return { paths, ends, sx, sy, yTicks, tickDecimals, xTicks, iw, ih, right, allX };
  }, [series, width, height, referenceLines, referenceBand, multi, decimals]);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + M.left;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const x of geo.allX) {
      const dist = Math.abs(geo.sx(x) - px);
      if (dist < bestDist) [best, bestDist] = [x, dist];
    }
    setHoverX(best);
  };

  // Leitura do mouse: o valor de cada linha naquele ponto (a mais alta primeiro, como no gráfico)
  const readout =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX && p.y !== null) }))
          .filter((r): r is { s: ChartSeries; p: ChartPoint & { y: number } } => r.p !== undefined)
          .sort((a, b) => b.p.y - a.p.y);
  const top = readout[0];

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
            <line x1={M.left} x2={M.left + geo.iw} y1={geo.sy(t)} y2={geo.sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text className="tick" x={M.left - 8} y={geo.sy(t)} dy="0.32em" textAnchor="end">
              {formatValue(t, undefined, Number.isInteger(t) ? 0 : geo.tickDecimals)}
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
              x2={M.left + geo.iw}
              y1={geo.sy(r.value)}
              y2={geo.sy(r.value)}
              stroke="var(--ref)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text className="ref-label" x={M.left + geo.iw} y={geo.sy(r.value) - 5} textAnchor="end">
              {r.label}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <path key={s.id} d={geo.paths[i]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {multi &&
          geo.ends.map((e) => (
            <text key={e.id} className="end-label" x={M.left + geo.iw + 8} y={e.y} dy="0.32em">
              {e.label}
            </text>
          ))}
        {hoverX !== null && top && (
          <g pointerEvents="none">
            <line x1={geo.sx(hoverX)} x2={geo.sx(hoverX)} y1={M.top} y2={height - M.bottom} stroke="var(--text-muted)" strokeWidth={1} />
            {readout.map(({ s, p }) => (
              <circle key={s.id} cx={geo.sx(p.x)} cy={geo.sy(p.y)} r={4.5} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={geo.iw}
          height={geo.ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
        />
      </svg>
      {hoverX !== null && top && (
        <div
          className={`tooltip${multi ? ' multi' : ''}`}
          style={
            multi
              ? // Várias linhas: a leitura fica no alto, ao lado da cruz, para não cobrir os pontos
                geo.sx(hoverX) > width * 0.6
                ? { right: width - geo.sx(hoverX) + 12, top: M.top }
                : { left: geo.sx(hoverX) + 12, top: M.top }
              : { left: Math.min(Math.max(geo.sx(hoverX), 70), width - 70), top: geo.sy(top.p.y) }
          }
        >
          {multi ? (
            <>
              <span className="tooltip-period">{top.p.label}</span>
              {readout.map(({ s, p }) => (
                <span key={s.id} className="tooltip-row">
                  <span className="line-key" style={{ background: s.color }} aria-hidden />
                  <strong>{formatValue(p.y, unit, decimals)}</strong>
                  {s.label}
                </span>
              ))}
            </>
          ) : (
            <>
              <strong>{formatValue(top.p.y, unit, decimals)}</strong>
              {top.p.label}
            </>
          )}
        </div>
      )}
    </div>
  );
}
