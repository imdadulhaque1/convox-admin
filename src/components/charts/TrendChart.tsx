"use client";

import { useId, useRef, useState } from "react";
import type { DailyCount } from "@/lib/types";

const WIDTH = 600;
const HEIGHT = 180;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const PAD_X = 4;

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

interface Point {
  x: number;
  y: number;
}

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson) through every point — a smooth
 * flowing curve, but one that's *guaranteed* not to overshoot past either endpoint's
 * value within a segment. A naive Catmull-Rom/tension spline doesn't have that
 * guarantee: a sharp isolated spike surrounded by zeros (a realistic daily-count shape —
 * one report filed on one day, say) makes it swing *below* zero right after the peak,
 * which reads as a broken chart for a value that can never be negative. This is the same
 * fix d3 ships as `curveMonotoneX`.
 */
function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x} ${points[0].y}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
  }

  // Initial tangents, then clamp to zero at local extrema and rescale otherwise so the
  // curve can't swing past either neighboring value — the monotonicity guarantee.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] === 0 || slope[i] === 0 || slope[i - 1] * slope[i] < 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + dx[i] / 3;
    const cp1y = p0.y + (m[i] * dx[i]) / 3;
    const cp2x = p1.x - dx[i] / 3;
    const cp2y = p1.y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/**
 * A single-series trend line over time (dataviz: "trend over time" → line/area, one
 * hue). One series needs no legend box — the chart's own title names it. Crosshair
 * hover snaps to the nearest day and shows date + value; the last point carries a
 * permanent end-label (the headline number, per "lines → value at the end").
 */
export function TrendChart({
  data,
  color,
  seriesLabel,
}: {
  data: DailyCount[];
  color: string;
  seriesLabel: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  const max = Math.max(1, ...data.map((d) => d.count));
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = PAD_X + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2);
    const y = PAD_TOP + plotHeight - (d.count / max) * plotHeight;
    return { x, y, ...d };
  });

  const baseline = PAD_TOP + plotHeight;
  const linePath = smoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = first ? `${linePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z` : "";

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - pointerX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-xs font-medium text-slate-500">{seriesLabel}</p>
        <p className="text-xs text-slate-400">{total} total</p>
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none overflow-visible"
          style={{ height: "auto" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${seriesLabel} over time, ${total} total`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive gridlines at 0 / mid / max */}
          {[0, 0.5, 1].map((f) => {
            const y = PAD_TOP + plotHeight * (1 - f);
            return (
              <line key={f} x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} stroke="#EEF1F6" strokeWidth={1} />
            );
          })}

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 2px 3px ${color}4D)` }}
          />

          {last && (
            <g>
              {/* Soft pulsing ring behind the latest point — draws the eye to "now" */}
              <circle cx={last.x} cy={last.y} r={4} fill={color} opacity={0.35}>
                <animate attributeName="r" values="4;10;4" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle cx={last.x} cy={last.y} r={4} fill={color} stroke="white" strokeWidth={2} />
            </g>
          )}

          {hovered && (
            <>
              <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={baseline} stroke="#CBD5E1" strokeWidth={1} />
              <circle cx={hovered.x} cy={hovered.y} r={5} fill={color} stroke="white" strokeWidth={2} />
            </>
          )}

          {/* Sparse x-axis labels: first, middle, last */}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1]
            .filter((idx, i, arr) => arr.indexOf(idx) === i && points[idx])
            .map((idx) => (
              <text
                key={idx}
                x={points[idx].x}
                y={HEIGHT - 6}
                textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
                className="fill-slate-400"
                fontSize={11}
              >
                {formatShortDate(points[idx].date)}
              </text>
            ))}
        </svg>

        {hovered && (
          <div
            className="chart-tooltip pointer-events-none absolute top-0 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
          >
            <span className="font-semibold">{hovered.count}</span> · {formatShortDate(hovered.date)}
          </div>
        )}
      </div>
    </div>
  );
}
