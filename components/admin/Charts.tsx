"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Table2, X } from "lucide-react";

// Small, dependency-free SVG charts for the admin dashboard.
// Spec (dataviz): single series → one accent hue, no legend box (the title
// names it); 2px line + ~10% area wash; bars ≤ 24px with a 4px rounded data
// end, square at the baseline; solid hairline grid; crosshair tooltip on
// lines, per-mark tooltip on bars; every chart has a table view.
// Colours come from tokens, so palettes + dark mode just work.

export type Point = { label: string; value: number };

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

// Axis top = 4 integer ticks just above the data (9 → 12, 76 → 80, 137 → 160).
function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 4) return 4;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 3, 4, 5, 10].map((u) => u * pow).find((s) => s >= raw) ?? 10 * pow;
  return step * 4;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// "2026-10-24" → "10/24"
export function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : day;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 10, 0), Math.max(0, width - 140));
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[7rem] rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-xs shadow-float"
      style={{ left, top: Math.max(0, y - 56) }}
    >
      {children}
    </div>
  );
}

function YGrid({ max, w, h }: { max: number; w: number; h: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.top + h - (t / max) * h;
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + w}
              y1={y}
              y2={y}
              className="stroke-[color:var(--line)]"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-[color:var(--muted)] text-[10px] tabular-nums"
            >
              {compact(Math.round(t))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ data, x, h }: { data: Point[]; x: (i: number) => number; h: number }) {
  const n = data.length;
  const every = Math.max(1, Math.ceil(n / 6));
  return (
    <g>
      {data.map((p, i) =>
        i % every === 0 || i === n - 1 ? (
          <text
            key={p.label}
            x={x(i)}
            y={PAD.top + h + 16}
            textAnchor="middle"
            className="fill-[color:var(--muted)] text-[10px] tabular-nums"
          >
            {shortDay(p.label)}
          </text>
        ) : null,
      )}
    </g>
  );
}

export function AreaChart({ data, unit, height = 200 }: { data: Point[]; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const x = (i: number) =>
    PAD.left + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => PAD.top + h - (v / max) * h;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = data.length
    ? `${line} L${x(data.length - 1)},${PAD.top + h} L${x(0)},${PAD.top + h} Z`
    : "";
  const last = data.length - 1;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!data.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round((px / Math.max(1, w)) * (data.length - 1));
    setHover(Math.min(Math.max(0, i), last));
  }
  // A stale index (data shrank after a range change) must never be read.
  const hv = hover !== null && hover >= 0 && hover < data.length ? hover : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="推移グラフ">
          <YGrid max={max} w={w} h={h} />
          <path d={area} className="fill-vermilion/10" />
          <path
            d={line}
            fill="none"
            className="stroke-vermilion"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* end marker + selective direct label (latest value) */}
          {last >= 0 && (
            <>
              <circle
                cx={x(last)}
                cy={y(data[last].value)}
                r={4}
                className="fill-vermilion stroke-[color:var(--surface)]"
                strokeWidth={2}
              />
              <text
                x={x(last) - 6}
                y={y(data[last].value) - 10}
                textAnchor="end"
                className="fill-[color:var(--foreground)] text-[11px] font-bold tabular-nums"
              >
                {compact(data[last].value)}
              </text>
            </>
          )}
          {hv !== null && (
            <>
              <line
                x1={x(hv)}
                x2={x(hv)}
                y1={PAD.top}
                y2={PAD.top + h}
                className="stroke-[color:var(--muted)]"
                strokeWidth={1}
              />
              <circle
                cx={x(hv)}
                cy={y(data[hv].value)}
                r={4}
                className="fill-vermilion stroke-[color:var(--surface)]"
                strokeWidth={2}
              />
            </>
          )}
          <XLabels data={data} x={x} h={h} />
          <rect
            x={PAD.left}
            y={PAD.top}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hv !== null && (
        <Tooltip x={x(hv)} y={y(data[hv].value)} width={width}>
          <p className="text-sm font-black tabular-nums">
            {data[hv].value.toLocaleString("ja-JP")}
            <span className="ml-1 text-[11px] font-bold text-[color:var(--muted)]">{unit}</span>
          </p>
          <p className="text-[11px] text-[color:var(--muted)]">{data[hv].label}</p>
        </Tooltip>
      )}
    </div>
  );
}

// Columns with a rounded top (data end) and a square base.
function columnPath(x: number, yTop: number, w: number, base: number) {
  const h = base - yTop;
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop + r} L${x + w},${base} Z`;
}

export function ColumnChart({ data, unit, height = 200 }: { data: Point[]; unit: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = data.length ? w / data.length : 0;
  const barW = Math.min(24, Math.max(2, band - 2)); // 2px surface gap between bars
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const base = PAD.top + h;
  const y = (v: number) => base - (v / max) * h;
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="棒グラフ">
          <YGrid max={max} w={w} h={h} />
          {data.map((d, i) => (
            <g key={d.label}>
              <path
                d={columnPath(cx(i) - barW / 2, y(d.value), barW, base)}
                className={hover === i ? "fill-vermilion" : "fill-vermilion/80"}
              />
              {/* hit target = the whole band, bigger than the mark */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={h}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${d.value}${unit}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          ))}
          {data[peak] && data[peak].value > 0 && hover === null && (
            <text
              x={cx(peak)}
              y={y(data[peak].value) - 6}
              textAnchor="middle"
              className="fill-[color:var(--foreground)] text-[11px] font-bold tabular-nums"
            >
              {compact(data[peak].value)}
            </text>
          )}
          <XLabels data={data} x={cx} h={h} />
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={cx(hover)} y={y(data[hover].value)} width={width}>
          <p className="text-sm font-black tabular-nums">
            {data[hover].value.toLocaleString("ja-JP")}
            <span className="ml-1 text-[11px] font-bold text-[color:var(--muted)]">{unit}</span>
          </p>
          <p className="text-[11px] text-[color:var(--muted)]">{data[hover].label}</p>
        </Tooltip>
      )}
    </div>
  );
}

// Horizontal bars for ranked categories: label · bar · value at the tip.
export function HBarChart({ rows, unit }: { rows: Point[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-xs font-medium text-[color:var(--muted)]">
        まだデータがありません。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3"
          title={`${r.label}: ${r.value.toLocaleString("ja-JP")}${unit}`}
        >
          <span className="truncate text-xs font-bold">{r.label}</span>
          <span className="h-3.5 w-full">
            <span
              className="block h-full rounded-r bg-vermilion/80"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-xs font-black tabular-nums text-[color:var(--foreground)]">
            {r.value.toLocaleString("ja-JP")}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Card shell with a title and a table-view toggle (tooltips never gate data).
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: { columns: [string, string]; rows: [string, string][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          {showTable ? <X size={12} /> : <Table2 size={12} />}
          {showTable ? "グラフ" : "表で見る"}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[color:var(--muted)]">
                <th className="py-1.5 font-bold">{table.columns[0]}</th>
                <th className="py-1.5 text-right font-bold">{table.columns[1]}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(([a, b]) => (
                <tr key={a} className="border-t border-[color:var(--line)]">
                  <td className="py-1.5">{a}</td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
