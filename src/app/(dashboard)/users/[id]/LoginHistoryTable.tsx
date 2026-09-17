"use client";

import { History, MonitorSmartphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { STICKY_THEAD, TableScroll } from "@/components/TableScroll";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatDateTime } from "@/lib/format";
import type { LoginEventSummary } from "@/lib/types";

const METHOD_LABEL: Record<LoginEventSummary["method"], string> = {
  PASSWORD: "Password",
  EMAIL_VERIFICATION: "Email verification",
};

export function LoginHistoryTable({ userId }: { userId: number }) {
  const { items, loading, loadingMore, hasMore, error, loadMore } =
    usePaginatedList<LoginEventSummary>(`/api/admin/users/${userId}/login-history`, {});

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-card">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-red-600 shadow-card">
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
        <EmptyState icon={History} title="No login history" description="Nothing recorded for this account yet." />
      </div>
    );
  }

  return (
    <div>
      <TableScroll maxHeight="60vh">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={STICKY_THEAD}>
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">IP address</th>
              <th className="px-5 py-3">Device / user agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((event) => (
              <tr key={event.id}>
                <td className="px-5 py-3 text-ink">
                  <div className="flex items-center gap-2">
                    {formatDateTime(event.createdAt)}
                    {event.isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        <MonitorSmartphone size={11} />
                        Current session
                      </span>
                    )}
                  </div>
                </td>
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
      {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
    </div>
  );
}
