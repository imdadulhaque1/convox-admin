"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Flag, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ReasonBadge, ReportStatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { STICKY_THEAD, TableScroll } from "@/components/TableScroll";
import { useToast } from "@/components/Toast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { mutate as apiMutate } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import type { AdminReportSummary, ReportStatus } from "@/lib/types";

const TABS: { value: ReportStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "DISMISSED", label: "Dismissed" },
];

/**
 * The moderation queue table. Used both globally (/reports, every report) and scoped to
 * one user (the Reports tab on a user's detail page) — pass `userId` for the latter.
 * `showReported` hides the "Reported" column when it would just repeat the page you're
 * already on.
 */
export function ReportsTable({
  userId,
  showReported = true,
}: {
  userId?: number;
  showReported?: boolean;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<ReportStatus | "ALL">("PENDING");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const path = userId ? `/api/admin/users/${userId}/reports` : "/api/admin/reports";
  const { items, setItems, loading, loadingMore, hasMore, error, loadMore } =
    usePaginatedList<AdminReportSummary>(path, {
      status: status === "ALL" ? undefined : status,
    });

  async function resolve(reportId: number, next: "REVIEWED" | "DISMISSED") {
    setResolvingId(reportId);
    try {
      await apiMutate(`/api/admin/reports/${reportId}/resolve`, "PATCH", { status: next });
      setItems((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: next, reviewedAt: new Date().toISOString() } : r)),
      );
      toast.push("success", next === "REVIEWED" ? "Report marked reviewed." : "Report dismissed.");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Could not update the report.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition ${
              status === tab.value ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-card">
          Loading reports…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <EmptyState icon={Flag} title="No reports here" description="Nothing matches this filter." />
        </div>
      ) : (
        <TableScroll maxHeight="60vh">
          <table className={`w-full text-left text-sm ${showReported ? "min-w-[880px]" : "min-w-[720px]"}`}>
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-5 py-3">Reporter</th>
                {showReported && <th className="px-5 py-3">Reported user</th>}
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Filed</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((report) => (
                <tr key={report.id}>
                  <td className="px-5 py-3">
                    <UserCell id={report.reporter.id} username={report.reporter.username} name={report.reporter.name} avatarUrl={report.reporter.avatarUrl} />
                  </td>
                  {showReported && (
                    <td className="px-5 py-3">
                      <UserCell id={report.reported.id} username={report.reported.username} name={report.reported.name} avatarUrl={report.reported.avatarUrl} />
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <ReasonBadge reason={report.reason} />
                  </td>
                  <td className="max-w-[16rem] truncate px-5 py-3 text-slate-500" title={report.details ?? undefined}>
                    {report.details ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(report.createdAt)}</td>
                  <td className="px-5 py-3">
                    <ReportStatusBadge status={report.status} />
                  </td>
                  <td className="px-5 py-3">
                    {report.status === "PENDING" && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => resolve(report.id, "REVIEWED")}
                          disabled={resolvingId === report.id}
                          className="focus-ring flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                        >
                          <Check size={12} />
                          Reviewed
                        </button>
                        <button
                          onClick={() => resolve(report.id, "DISMISSED")}
                          disabled={resolvingId === report.id}
                          className="focus-ring flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          <X size={12} />
                          Dismiss
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
    </div>
  );
}

function UserCell({
  id,
  username,
  name,
  avatarUrl,
}: {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <Link
      href={`/users/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2.5 hover:underline"
    >
      <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{name}</p>
        <p className="truncate text-xs text-slate-400">@{username}</p>
      </div>
    </Link>
  );
}
