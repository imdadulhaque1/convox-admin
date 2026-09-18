"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface StatusSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
}

/**
 * Part-to-whole status breakdown as a single horizontal stacked bar (dataviz's
 * `choosing-a-form`: part-to-whole → stacked bar, not a pie — a 2-3 slice pie reads
 * worse than a bar people can actually compare). Status colors always ship with an
 * icon + label (never color alone), so the legend row underneath carries both.
 */
export function StackedStatusBar({ segments }: { segments: StatusSegment[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Precompute each segment's [start%, width%] once — used for both the bar itself and
  // to position the tooltip, which must NOT live inside the bar's own overflow-hidden
  // (that's what clips it to a rounded pill) or it gets clipped away too.
  let cursor = 0;
  const positioned = segments.map((s) => {
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return { ...s, pct, start };
  });
  const visible = positioned.filter((s) => s.pct > 0);
  const hoveredSeg = visible.find((s) => s.key === hovered);

  return (
    <div>
      <div className="relative">
        <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
          {visible.map((segment, i) => {
            const isHovered = hovered === segment.key;
            const isDimmed = hovered !== null && !isHovered;
            return (
              <div
                key={segment.key}
                role="img"
                aria-label={`${segment.label}: ${segment.value} (${segment.pct.toFixed(0)}%)`}
                tabIndex={0}
                onPointerEnter={() => setHovered(segment.key)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(segment.key)}
                onBlur={() => setHovered(null)}
                className={`flex items-center justify-center ${i === 0 ? "rounded-l-full" : ""} ${i === visible.length - 1 ? "rounded-r-full" : ""} ${isDimmed ? "opacity-50" : "opacity-100"}`}
                style={{
                  width: `${segment.pct}%`,
                  backgroundColor: segment.color,
                  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0) 55%)",
                  transition: "width 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, filter 0.15s ease",
                  filter: isHovered ? "brightness(1.08)" : "brightness(1)",
                }}
              >
                {segment.pct >= 12 && (
                  <span className="text-xs font-semibold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.15)]">
                    {segment.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {hoveredSeg && (
          <div
            className="chart-tooltip pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            style={{ left: `${hoveredSeg.start + hoveredSeg.pct / 2}%` }}
          >
            <span className="font-semibold">{hoveredSeg.value}</span> {hoveredSeg.label} ({hoveredSeg.pct.toFixed(0)}%)
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => {
          const Icon = segment.icon;
          return (
            <div key={segment.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="flex h-4 w-4 items-center justify-center rounded"
                style={{ backgroundColor: `${segment.color}1A`, color: segment.color }}
              >
                <Icon size={11} />
              </span>
              <span className="font-medium text-ink">{segment.value}</span>
              <span>{segment.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
