"use client";

import { useMemo, useState } from "react";
import { Plus, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RoleBadge } from "@/components/Badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { STICKY_THEAD, TableScroll } from "@/components/TableScroll";
import { useToast } from "@/components/Toast";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { mutate as apiMutate, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { readWhoAmIClient } from "@/lib/whoamiClient";
import type { AdminAccountSummary, AdminRole } from "@/lib/types";

/**
 * Managing the separate admin-panel accounts themselves (POST/GET/DELETE /admin/admins,
 * proxied at /api/admin/admins). SUPER_ADMIN only — enforced server-side by
 * SuperAdminOnlyGuard; a plain ADMIN hitting this page just sees the resulting 403.
 * There's no self-registration and no edit — only create and delete.
 */
export default function AdminsPage() {
  const toast = useToast();
  const me = useMemo(() => readWhoAmIClient(), []);

  const { items, setItems, loading, hasMore, loadingMore, error, loadMore } =
    usePaginatedList<AdminAccountSummary>("/api/admin/admins", {});

  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminAccountSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiMutate(`/api/admin/admins/${pendingDelete.id}`, "DELETE");
      setItems((prev) => prev.filter((a) => a.id !== pendingDelete.id));
      toast.push("success", `${pendingDelete.username} removed.`);
      setPendingDelete(null);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Could not remove this admin.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Admins"
        description="Who can sign in to this panel — separate from ConvoX user accounts."
        action={
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus size={15} />
            New admin
          </button>
        }
      />

      {formOpen && (
        <CreateAdminForm
          onCreated={(admin) => {
            setItems((prev) => [admin, ...prev]);
            setFormOpen(false);
            toast.push("success", `${admin.username} can now sign in to the panel.`);
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-card">
          Loading admins…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <EmptyState icon={UserCog} title="No admins found" description="Something's off — there should always be at least one." />
        </div>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((admin) => {
                const isSelf = me?.id === admin.id;
                return (
                  <tr key={admin.id}>
                    <td className="px-5 py-3">
                      <span className="font-medium text-ink">@{admin.username}</span>
                      {isSelf && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{admin.email}</td>
                    <td className="px-5 py-3">
                      <RoleBadge role={admin.role} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDateTime(admin.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setPendingDelete(admin)}
                        disabled={isSelf}
                        title={isSelf ? "You can't delete your own admin account" : "Remove admin"}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}

      {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this admin?"
        description={
          pendingDelete
            ? `@${pendingDelete.username} will immediately lose access to this panel on every device.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

function CreateAdminForm({
  onCreated,
  onCancel,
}: {
  onCreated: (admin: AdminAccountSummary) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("ADMIN");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const admin = await apiMutate<AdminAccountSummary>("/api/admin/admins", "POST", {
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });
      onCreated(admin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this admin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
          <input
            type="text"
            required
            autoFocus
            minLength={2}
            maxLength={30}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane"
            className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            minLength={4}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
          <div className="flex gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                className={`focus-ring flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  role === option.value
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create admin"}
        </button>
      </div>
    </form>
  );
}
