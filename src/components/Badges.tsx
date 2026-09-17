import type { AdminRole, ReportReason, ReportStatus } from "@/lib/types";

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Pill className="bg-emerald-50 text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </Pill>
  ) : (
    <Pill className="bg-red-50 text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Deactivated
    </Pill>
  );
}

/** For the separate Admin-table identity (admin-panel accounts) — see /admins. ConnectX
 *  Users no longer carry a role at all (see AdminUserSummary's doc-comment). */
export function RoleBadge({ role }: { role: AdminRole }) {
  return role === "SUPER_ADMIN" ? (
    <Pill className="bg-violet-50 text-violet-700">Super Admin</Pill>
  ) : (
    <Pill className="bg-blue-50 text-blue-700">Admin</Pill>
  );
}

const REPORT_STATUS_STYLE: Record<ReportStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  REVIEWED: "bg-emerald-50 text-emerald-700",
  DISMISSED: "bg-slate-100 text-slate-500",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Pill className={REPORT_STATUS_STYLE[status]}>{titleCase(status)}</Pill>;
}

const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  FAKE_ACCOUNT: "Fake account",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  OTHER: "Other",
};

export function ReasonBadge({ reason }: { reason: ReportReason }) {
  return <Pill className="bg-orange-50 text-orange-700">{REASON_LABEL[reason]}</Pill>;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
