"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Cake,
  Flag,
  History,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/Badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PromptDialog } from "@/components/PromptDialog";
import { useToast } from "@/components/Toast";
import { fetcher, mutate as apiMutate } from "@/lib/fetcher";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AdminUserDetail } from "@/lib/types";
import { LoginHistoryTable } from "./LoginHistoryTable";
import { ReportsTable } from "@/components/ReportsTable";

type PendingAction = { kind: "reactivate" } | { kind: "delete" } | { kind: "force-logout" } | null;
type PromptAction = "deactivate" | "password" | "username" | null;

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const userId = params.id;

  const { data: user, error, isLoading, mutate: refresh } = useSWR<AdminUserDetail>(
    `/api/admin/users/${userId}`,
    fetcher,
  );

  const [tab, setTab] = useState<"history" | "reports">("history");
  const [pending, setPending] = useState<PendingAction>(null);
  const [prompt, setPrompt] = useState<PromptAction>(null);
  const [working, setWorking] = useState(false);

  async function runPendingAction() {
    if (!pending || !user) return;
    setWorking(true);
    try {
      if (pending.kind === "reactivate") {
        await apiMutate(`/api/admin/users/${user.id}/reactivate`, "PATCH");
        toast.push("success", "User reactivated.");
      } else if (pending.kind === "delete") {
        await apiMutate(`/api/admin/users/${user.id}`, "DELETE");
        toast.push("success", "User deleted.");
      } else if (pending.kind === "force-logout") {
        await apiMutate(`/api/admin/users/${user.id}/force-logout`, "POST");
        toast.push("success", "User has been logged out on every device.");
      }
      await refresh();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
      setPending(null);
    }
  }

  async function runPromptAction(value: string) {
    if (!prompt || !user) return;
    setWorking(true);
    try {
      if (prompt === "deactivate") {
        const days = Number(value);
        await apiMutate(`/api/admin/users/${user.id}/deactivate`, "PATCH", { days });
        toast.push("success", `User deactivated for ${days} day${days === 1 ? "" : "s"}.`);
      } else if (prompt === "password") {
        await apiMutate(`/api/admin/users/${user.id}/password`, "PATCH", { password: value });
        toast.push("success", "Password updated. Every session for this user was signed out.");
      } else if (prompt === "username") {
        await apiMutate(`/api/admin/users/${user.id}/username`, "PATCH", { username: value });
        toast.push("success", "Username updated.");
      }
      await refresh();
      setPrompt(null);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-slate-400">Loading user…</div>;
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <button onClick={() => router.push("/users")} className="focus-ring mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={15} /> Back to users
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "User not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button onClick={() => router.push("/users")} className="focus-ring mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={15} /> Back to users
      </button>

      {/* Profile card */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-ink">{user.name}</h1>
                {user.isEmailVerified && (
                  <span title="Email verified" className="text-brand-600">
                    <BadgeCheck size={16} />
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">@{user.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill isActive={user.isActive} />
                {!user.isActive && (
                  <span className="text-xs text-slate-400">
                    {user.deletedAt
                      ? `Deleted ${formatDateTime(user.deletedAt)}`
                      : user.deactivatedUntil
                        ? `Until ${formatDateTime(user.deactivatedUntil)}`
                        : null}
                  </span>
                )}
                {user.isPrivate && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    Private account
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {user.isActive ? (
              <button
                onClick={() => setPrompt("deactivate")}
                className="focus-ring flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                <Ban size={15} />
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => setPending({ kind: "reactivate" })}
                className="focus-ring flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                <Ban size={15} />
                Reactivate
              </button>
            )}
            <button
              onClick={() => setPending({ kind: "force-logout" })}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={15} />
              Force logout
            </button>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
          <InfoRow icon={Mail} label="Email" value={user.email} />
          <InfoRow icon={Phone} label="Phone" value={user.phoneNumber ?? "—"} />
          <InfoRow icon={UserRound} label="Gender" value={user.gender ?? "—"} />
          <InfoRow icon={Cake} label="Date of birth" value={user.dateOfBirth ? formatDateTime(user.dateOfBirth) : "—"} />
          <InfoRow icon={History} label="Joined" value={formatDateTime(user.createdAt)} />
          <InfoRow
            icon={ShieldCheck}
            label="Presence"
            value={user.isOnline ? "Online now" : `Last seen ${formatRelative(user.lastSeenAt)}`}
          />
          <InfoRow icon={Flag} label="Reports received" value={String(user.reportCount)} />
        </dl>

        {user.bio && (
          <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm text-slate-600">
            {user.bio}
          </p>
        )}
      </div>

      {/* Account settings — direct edits, distinct from the status actions above */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-ink">Account</h2>
        <p className="mb-4 text-sm text-slate-500">
          Set a new password or username directly — no confirmation from the user needed.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPrompt("password")}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <KeyRound size={15} />
            Change password
          </button>
          <button
            onClick={() => setPrompt("username")}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <UserCog size={15} />
            Change username
          </button>
          <button
            onClick={() => setPending({ kind: "delete" })}
            disabled={Boolean(user.deletedAt)}
            title={user.deletedAt ? "Already deleted — reactivate first" : undefined}
            className="focus-ring ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={15} />
            Delete permanently
          </button>
        </div>
      </div>

      {/* Tabs: login history / reports */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-200/60 p-1" style={{ width: "fit-content" }}>
        <button
          onClick={() => setTab("history")}
          className={`focus-ring rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
            tab === "history" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
          }`}
        >
          Login history
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`focus-ring rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
            tab === "reports" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
          }`}
        >
          Reports received
        </button>
      </div>

      {tab === "history" ? (
        <LoginHistoryTable userId={user.id} />
      ) : (
        <ReportsTable userId={user.id} showReported={false} />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={confirmTitle(pending, user)}
        description={confirmDescription(pending, user)}
        confirmLabel={confirmLabel(pending, user)}
        tone="danger"
        loading={working}
        onConfirm={runPendingAction}
        onCancel={() => setPending(null)}
      />

      <PromptDialog
        open={prompt === "deactivate"}
        title="Deactivate this user"
        description="Locks them out until this many days pass — auto-lifts on their next login attempt after that, or reactivate early any time."
        label="Days (1-365)"
        type="number"
        placeholder="7"
        confirmLabel="Deactivate"
        loading={working}
        validate={(v) => {
          const n = Number(v);
          return Number.isInteger(n) && n >= 1 && n <= 365 ? null : "Enter a whole number of days, 1-365.";
        }}
        onConfirm={runPromptAction}
        onCancel={() => setPrompt(null)}
      />

      <PromptDialog
        open={prompt === "password"}
        title="Change this user's password"
        description="They'll be signed out everywhere and need the new password to log back in."
        label="New password"
        type="password"
        placeholder="••••••••"
        confirmLabel="Change password"
        loading={working}
        validate={(v) => (v.length >= 4 && v.length <= 72 ? null : "4-72 characters.")}
        onConfirm={runPromptAction}
        onCancel={() => setPrompt(null)}
      />

      <PromptDialog
        open={prompt === "username"}
        title="Change this user's username"
        label="New username"
        type="text"
        defaultValue={user.username}
        placeholder="jane_doe"
        confirmLabel="Change username"
        loading={working}
        validate={(v) =>
          v.length >= 3 && v.length <= 30 && USERNAME_PATTERN.test(v)
            ? null
            : "3-30 characters: letters, numbers, dots and underscores only."
        }
        onConfirm={runPromptAction}
        onCancel={() => setPrompt(null)}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <div>
        <dt className="text-xs text-slate-400">{label}</dt>
        <dd className="text-slate-700">{value}</dd>
      </div>
    </div>
  );
}

function confirmTitle(pending: PendingAction, user: AdminUserDetail): string {
  if (!pending) return "";
  if (pending.kind === "reactivate") return "Reactivate this user?";
  if (pending.kind === "delete") return "Delete this user?";
  if (pending.kind === "force-logout") return "Force logout on every device?";
  return "";
}

function confirmDescription(pending: PendingAction, user: AdminUserDetail): string {
  if (!pending) return "";
  if (pending.kind === "reactivate") {
    return `${user.name} will be able to log in again immediately.`;
  }
  if (pending.kind === "delete") {
    return `${user.name} will be signed out everywhere and unable to log in. Their content stays intact and this can still be undone with Reactivate.`;
  }
  if (pending.kind === "force-logout") {
    return `${user.name} will be signed out on every device right away and must log in again.`;
  }
  return "";
}

function confirmLabel(pending: PendingAction, user: AdminUserDetail): string {
  if (!pending) return "Confirm";
  if (pending.kind === "reactivate") return "Reactivate";
  if (pending.kind === "delete") return "Delete";
  if (pending.kind === "force-logout") return "Log out everywhere";
  return "Confirm";
}
