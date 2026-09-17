"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { STICKY_THEAD, TableScroll } from "@/components/TableScroll";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { formatDateTime } from "@/lib/format";
import type { AdminUserSummary, UserStatusFilter } from "@/lib/types";

const TABS: { value: UserStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Deactivated" },
];

export default function UsersPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("all");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { items, loading, loadingMore, hasMore, error, loadMore } =
    usePaginatedList<AdminUserSummary>("/api/admin/users", { search, status });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Users"
        description="Every ConvoX account — search, review, and manage account status."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, username, email, phone…"
            className="focus-ring w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === tab.value
                  ? "bg-white text-ink shadow-sm"
                  : "text-slate-500 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-card">
          Loading users…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="Try a different search or status filter."
          />
        </div>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/users/${user.id}`)}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{user.name}</p>
                        <p className="truncate text-xs text-slate-400">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{user.email}</td>
                  <td className="px-5 py-3">
                    <StatusPill isActive={user.isActive} />
                    {!user.isActive && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {user.deletedAt
                          ? "Deleted"
                          : user.deactivatedUntil
                            ? `Until ${formatDateTime(user.deactivatedUntil)}`
                            : null}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(user.createdAt)}</td>
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
