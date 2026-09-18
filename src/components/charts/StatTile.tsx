import type { LucideIcon } from "lucide-react";

/** A single headline number — see dataviz's "Stat tile" contract. Value uses the font's
 *  default proportional figures (not tabular-nums — that's for columns of aligned
 *  numbers, not a standalone display value). */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "brand";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            tone === "brand" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon size={16} />
        </div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
