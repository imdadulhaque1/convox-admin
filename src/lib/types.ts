/**
 * Types mirrored 1:1 from the connectx_api backend (src/modules/admin/**, common/**).
 * Keep these in sync if the backend's admin DTOs change — see ../../README.md.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  errors?: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: number | string | null;
  hasMore: boolean;
}

export type UserStatusFilter = "all" | "active" | "inactive";

/** One row of GET /admin/users. Panel-admin status now lives entirely on the separate
 *  Admin table (see AdminAccountSummary) — ConnectX User rows no longer carry a role. */
export interface AdminUserSummary {
  id: number;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  deletedAt: string | null;
  /** Set for a *timed* suspension (PATCH .../deactivate); null for a permanent delete or
   *  an active account. Auto-lifts server-side on the user's next login attempt once this
   *  date passes — this app doesn't need to poll or compute that itself. */
  deactivatedUntil: string | null;
  createdAt: string;
}

export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
export type PrivacyLevel = "EVERYONE" | "FOLLOWERS" | "HIDDEN";

/** GET /admin/users/:id — the sanitized User row plus admin-only fields. */
export interface AdminUserDetail {
  id: number;
  email: string;
  username: string;
  phoneNumber: string | null;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  deletedAt: string | null;
  deactivatedUntil: string | null;
  profilePhotoPrivacy: PrivacyLevel;
  lastSeenPrivacy: PrivacyLevel;
  onlineStatusPrivacy: PrivacyLevel;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  reportCount: number;
}

export type LoginMethod = "PASSWORD" | "EMAIL_VERIFICATION";

/** One row of GET /admin/users/:id/login-history. */
export interface LoginEventSummary {
  id: number;
  method: LoginMethod;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "FAKE_ACCOUNT"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED";

export interface PublicUserSummary {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
}

/** One row of GET /admin/reports and GET /admin/users/:id/reports. */
export interface AdminReportSummary {
  id: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedById: number | null;
  reporter: PublicUserSummary;
  reported: PublicUserSummary;
}

/** One point of a daily-bucketed trend line — GET /admin/stats/{users,reports} zero-fill
 *  every day in the requested range, so a chart never has to handle gaps. */
export interface DailyCount {
  date: string;
  count: number;
}

/** GET /admin/stats/users. */
export interface UserStats {
  total: number;
  active: number;
  deactivated: number;
  deletedPermanently: number;
  suspendedTemporarily: number;
  signupsByDay: DailyCount[];
}

/** GET /admin/stats/reports. */
export interface ReportStats {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  byReason: Record<ReportReason, number>;
  reportsByDay: DailyCount[];
}

/** One row of GET /admin/stats/login-history — the global counterpart to
 *  GET /admin/users/:id/login-history (no `isCurrent`, since that's meaningless once
 *  you're looking across every user rather than one caller's own history). */
export interface AdminLoginEventSummary {
  id: number;
  method: LoginMethod;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: PublicUserSummary;
}

export type AdminRole = "ADMIN" | "SUPER_ADMIN";

/** The separate admin-panel identity (Admin table, not ConnectX User) — returned by
 *  POST /admin/auth/login and every row of GET /admin/admins. */
export interface AdminAccountSummary {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

/** Decoded once at login and stashed in a readable (non-httpOnly) cookie purely for the
 *  topbar — never used for authorization, the backend re-checks role via
 *  SuperAdminOnlyGuard on every request regardless of what this says. */
export interface AdminWhoAmI {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
}
