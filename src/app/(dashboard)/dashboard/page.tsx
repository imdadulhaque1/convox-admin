"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Clock,
  Flag,
  History,
  ShieldAlert,
  Users as UsersIcon,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/charts/StatTile";
import { StackedStatusBar } from "@/components/charts/StackedStatusBar";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { STICKY_THEAD, TableScroll } from "@/components/TableScroll";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import type { AdminLoginEventSummary, ReportStats, UserStats } from "@/lib/types";

const DAY_RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const STATUS_COLORS = {
  active: "#10b981",
  deactivated: "#ef4444",
  pending: "#f59e0b",
  reviewed: "#10b981",
  dismissed: "#0284c7",
  brand: "#4F46E5",
} as const;

const METHOD_LABEL: Record<AdminLoginEventSummary["method"], string> = {
  PASSWORD: "Password",
  EMAIL_VERIFICATION: "Email verification",
};

export default function DashboardPage() {
  const [days, setDays] = useState(30);

  const { data: userStats, error: userStatsError, isLoading: userStatsLoading } =
    useSWR<UserStats>(`/api/admin/stats/users?days=${days}`, fetcher);
  const { data: reportStats, error: reportStatsError, isLoading: reportStatsLoading } =
    useSWR<ReportStats>(`/api/admin/stats/reports?days=${days}`, fetcher);

  const {
    items: logins,
    loading: loginsLoading,
    loadingMore: loginsLoadingMore,
    hasMore: loginsHasMore,
    error: loginsError,
    loadMore: loadMoreLogins,
  } = usePaginatedList<AdminLoginEventSummary>("/api/admin/stats/login-history", {});

  const error = userStatsError || reportStatsError;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Dashboard"
        description="Everything at a glance — account status, moderation load, and recent activity."
        action={
          <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1">
            {DAY_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  days === range.value ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error instanceof Error ? error.message : "Could not load dashboard data."}</span>
        </div>
      )}

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total users" value={userStats?.total ?? "—"} icon={UsersIcon} tone="brand" />
        <StatTile label="Active users" value={userStats?.active ?? "—"} icon={CheckCircle2} />
        <StatTile label="Total reports" value={reportStats?.total ?? "—"} icon={Flag} tone="brand" />
        <StatTile label="Pending reports" value={reportStats?.pending ?? "—"} icon={Clock} />
      </div>

      {/* Users: status + signups trend */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-ink">Account status</h2>
          {userStatsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : userStats ? (
            <StackedStatusBar
              segments={[
                { key: "active", label: "Active", value: userStats.active, color: STATUS_COLORS.active, icon: CheckCircle2 },
                { key: "deactivated", label: "Deactivated", value: userStats.deactivated, color: STATUS_COLORS.deactivated, icon: Ban },
              ]}
            />
          ) : null}
          {userStats && userStats.deactivated > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Of {userStats.deactivated} deactivated: {userStats.suspendedTemporarily} suspended (self-lifting), {userStats.deletedPermanently} deleted.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          {userStatsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : userStats ? (
            <TrendChart data={userStats.signupsByDay} color={STATUS_COLORS.brand} seriesLabel="New signups" />
          ) : null}
        </div>
      </div>

      {/* Reports: status + trend */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-ink">Report status</h2>
          {reportStatsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : reportStats ? (
            <StackedStatusBar
              segments={[
                { key: "pending", label: "Pending", value: reportStats.pending, color: STATUS_COLORS.pending, icon: Clock },
                { key: "reviewed", label: "Reviewed", value: reportStats.reviewed, color: STATUS_COLORS.reviewed, icon: CheckCircle2 },
                { key: "dismissed", label: "Dismissed", value: reportStats.dismissed, color: STATUS_COLORS.dismissed, icon: XCircle },
              ]}
            />
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          {reportStatsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : reportStats ? (
            <TrendChart data={reportStats.reportsByDay} color={STATUS_COLORS.pending} seriesLabel="Reports filed" />
          ) : null}
        </div>
      </div>

      {/* Global login activity */}
      <div className="mb-2 flex items-center gap-2">
        <History size={15} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-ink">Recent login activity</h2>
      </div>

      {loginsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loginsError}
        </div>
      )}

      {loginsLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-card">
          Loading…
        </div>
      ) : logins.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <EmptyState icon={History} title="No logins yet" description="Sign-ins will show up here as they happen." />
        </div>
      ) : (
        <TableScroll maxHeight="420px">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">IP address</th>
                <th className="px-5 py-3">Device / user agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logins.map((event) => (
                <tr key={event.id}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/users/${event.user.id}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Avatar name={event.user.name} avatarUrl={event.user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{event.user.name}</p>
                        <p className="truncate text-xs text-slate-400">@{event.user.username}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink">{formatDateTime(event.createdAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{METHOD_LABEL[event.method]}</td>
                  <td className="px-5 py-3 text-slate-600">{event.ipAddress ?? "—"}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-500" title={event.userAgent ?? undefined}>
                    {event.userAgent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      {loginsHasMore && <LoadMoreButton onClick={loadMoreLogins} loading={loginsLoadingMore} />}
    </div>
  );
}
