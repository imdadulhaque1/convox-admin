# ConvoX Admin

Super-admin console for ConvoX (`/users`, `/reports`) — a separate Next.js (App Router,
TypeScript) app that talks to the same `connectx_api` NestJS backend the mobile app uses,
through its `admin/*` module.

## What it does

- **Users** — search/filter the full user directory, open a profile, deactivate/reactivate
  an account, force-logout every device, view login history, and see/resolve reports filed
  against that user.
- **Reports** — the global moderation queue across every user, filterable by status, with
  one-click "Mark reviewed" / "Dismiss".
- **Admins** — SUPER_ADMIN only: create/remove the accounts that can sign in to this panel
  at all. Separate from ConvoX user accounts entirely (see "How auth works" below).

Every one of these maps to an existing backend endpoint under `connectx_api/server/src/modules/admin/`
(`AdminUsersController`, `AdminReportsController`, `AdminsController`, `AdminAuthController`)
— this app adds no new backend behavior, it's a UI for what's already there.
`SuperAdminOnlyGuard` on the backend is the actual authorization boundary; nothing here can
bypass it.

## Setup

```bash
npm install
cp .env.local.example .env.local   # already done for this checkout — edit if the backend moves
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign in with an **Admin**
account (the separate `Admin` table, not a ConvoX `User`). There's no self-registration and
no bootstrapping endpoint, so the very first row has to be inserted directly (direct DB
access or Prisma Studio) with `role = SUPER_ADMIN` and a bcrypt `passwordHash` — after that,
every further admin is created from the Admins screen in this app.

## How auth works

This panel has its **own, separate login** — `/api/auth/login` calls
`POST /admin/auth/login`, not the ConnectX-user `/auth/login` the mobile app uses. It's a
different table (`Admin`, not `User`), a different JWT signing secret, and a username-only
login (not email-or-username). A successful login already implies panel access; no extra
probe call is needed the way an earlier version of this app used one.

Tokens (`accessToken` / `refreshToken`) are kept in **httpOnly cookies**, set and read only
by this app's own Route Handlers under `src/app/api/**` — they never reach client-side
JavaScript. Every one of those routes is a thin proxy (see `src/lib/backend.ts`,
`proxyToBackend`) that:

1. reads the cookies,
2. forwards the call to the real backend with `Authorization: Bearer <token>`,
3. if that comes back `401` (access token expired), calls `POST /admin/auth/refresh` once
   and retries the original call with the fresh access token — `AdminJwtAuthGuard` has no
   built-in silent-refresh-via-header the way the ConnectX-user `JwtAuthGuard` does (see
   API_INTEGRATION.md §3.3 for that contract; it does not apply to `/admin/*`), so this app
   does the refresh-and-retry itself rather than relying on the backend to do it,
4. persists whatever fresh pair comes back, or clears the session if the refresh token is
   dead too (expired, revoked, or logged in elsewhere) so the next page load bounces to
   `/login`.

Client Components never call the backend directly — they call this app's own `/api/admin/**`
routes with a plain same-origin `fetch`, via `src/lib/fetcher.ts`.

`middleware.ts` only checks that the session cookie *exists* before rendering a page (to
avoid flashing the dashboard before a redirect) — it is not the security boundary.
`SuperAdminOnlyGuard` on the backend, re-checked on every single request, is. (Today every
`/admin/*` route — Users, Reports, and Admins alike — requires `role = SUPER_ADMIN`; a plain
`ADMIN` account can sign in but has nothing to see yet.)

## Environment variables

See `.env.local.example`. `BACKEND_BASE_URL` / `BACKEND_MEDIA_URL` are both server-only —
no `NEXT_PUBLIC_*` var for the backend host exists at all, so it never appears in the
client bundle or the browser's Network tab. Every backend call is proxied through this
app's own `/api/**` routes: JSON via `/api/admin/**` (`lib/backend.ts`) and static files
(avatars etc.) via `/api/media/**` (`lib/media.ts`) — the browser only ever talks to this
app's own origin. `COOKIES_SECURE` must stay `false` while the backend is still the
bare-IP `http://40.81.26.50` — flip it once that's HTTPS, or browsers will silently drop
the cookies.

## Project layout

```
src/
  app/
    login/page.tsx                 Sign-in form (Admin username + password)
    forgot-password/page.tsx       Request a reset code
    reset-password/page.tsx        Enter code + new password
    (dashboard)/                   Everything behind the sidebar shell
      layout.tsx                  Reads the "who am I" cookie, renders DashboardShell
      users/page.tsx              User directory (search/filter/table)
      users/[id]/page.tsx         User detail (profile, actions, tabs)
      users/[id]/LoginHistoryTable.tsx
      reports/page.tsx            Global moderation queue
      admins/page.tsx             Admin accounts — create/remove (SUPER_ADMIN only)
    api/
      auth/login|logout/route.ts             Admin login/logout
      auth/forgot-password|reset-password/route.ts
      admin/**/route.ts           One thin proxy route per backend admin endpoint
      media/[...path]/route.ts    Streams avatars/uploads from the backend too — same reason
  components/                     Avatar, badges, ConfirmDialog, ReportsTable, Toast, shell…
  hooks/usePaginatedList.ts       Cursor-pagination against this app's own /api/admin/* routes
  lib/
    types.ts                     TS types mirrored from the backend's admin DTOs
    backend.ts                   Server-only fetch to the real backend + refresh-and-retry
    session.ts / whoamiClient.ts Cookie read/write (server) and read-only client helper
    fetcher.ts                   Client-side fetch/mutate helpers used by SWR & pages
    format.ts / media.ts         Date formatting, avatar URL resolution
```

## Keeping this in sync with the backend

If `connectx_api`'s admin module changes (new field, new endpoint, renamed DTO), update:

1. `src/lib/types.ts` — the mirrored interfaces
2. The relevant `src/app/api/admin/**/route.ts` proxy (usually a one-line path/method change)
3. The page/component rendering that data
