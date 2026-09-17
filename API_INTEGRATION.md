# ConnectX API — Integration Guide (for the Android/Kotlin client)

This document is a complete reference for building the ConnectX Android app against this
backend. It covers auth, every REST endpoint, the WebSocket (Socket.IO) events, file uploads,
data models, and concrete Kotlin/Retrofit integration notes.

> ### 🟢 Live server — quick reference
> | | |
> |---|---|
> | **Status** | Running 24/7 on a dedicated Azure VM |
> | **Base URL** | `http://40.81.26.50/api` |
> | **Swagger** | `http://40.81.26.50/docs` |
> | **Sockets** | `http://40.81.26.50/presence`, `/chat`, `/calls` (see §11) |
> | **Protocol** | Plain HTTP for now — add the §1 network security config to the Android app until HTTPS is set up |
>
> This IP is expected to stay fixed. If it's ever unreachable, check with whoever manages the
> server before assuming your code is at fault.

---

## 1. Base URL

The backend now runs on a dedicated Azure VM (24/7, not a personal laptop), so this URL is
**stable** — no more rotating tunnel URLs:

```
http://40.81.26.50/api
```

- No `v1` — the API is unversioned right now.
- Swagger/OpenAPI docs (browsable, "Try it out"): `http://40.81.26.50/docs`
- Raw OpenAPI JSON (can be fed into a Retrofit/OpenAPI codegen tool): `http://40.81.26.50/docs-json`

**⚠️ This is plain HTTP, not HTTPS yet** — the VM has no domain/TLS certificate pointed at it
yet (only an IP). Android 9+ blocks cleartext traffic by default, so add a network security
config until a domain + Let's Encrypt cert is set up (ask for that migration once a domain is
ready — it's a quick follow-up, and the URL will then become `https://api.yourdomain.com`
instead of the raw IP):

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">40.81.26.50</domain>
    </domain-config>
</network-security-config>
```
```xml
<!-- AndroidManifest.xml, on the <application> tag -->
<application android:networkSecurityConfig="@xml/network_security_config" ...>
```

For local development against your own machine instead of the shared Azure server:

| Client location | Base URL |
|---|---|
| Android **emulator**, same machine as a locally-run server | `http://10.0.2.2:3000/api` |
| Physical device on the **same Wi-Fi** as a locally-run server | `http://<your-machine-LAN-IP>:3000/api` |

---

## 2. Response envelope

**Every** response — success or error — has a consistent shape. Model this once and reuse it
for all Retrofit calls.

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully",
  "data": { }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid credentials",
  "errors": ["optional array of field-validation messages"],
  "path": "/api/auth/login",
  "timestamp": "2026-08-17T12:53:27.013Z"
}
```

`errors` is only present for `400` validation failures (one string per failed field rule).

Kotlin wrapper suggestion:

```kotlin
data class ApiResponse<T>(
    val success: Boolean,
    val statusCode: Int,
    val message: String,
    val data: T?,
    val errors: List<String>? = null,
    val path: String? = null,
    val timestamp: String? = null,
)
```

---

## 3. Authentication & token strategy

### 3.1 Flow

1. `POST /auth/register` → creates the account (unverified), sends a 4-digit OTP to the email.
2. `POST /auth/verify-email` → confirms the OTP, **and returns the first token pair** (also
   works as an implicit login).
3. `POST /auth/login` → for returning users → returns a token pair.
4. Every authenticated request: `Authorization: Bearer <accessToken>`.
5. When the access token expires, call `POST /auth/refresh` with the refresh token to get a
   new pair — **or** rely on the automatic silent-refresh described below.

### 3.2 Token lifetimes

| Token | Lifetime | Type |
|---|---|---|
| Access token | **8 hours** | JWT (HS256), `Authorization: Bearer` header |
| Refresh token | **Until logout** — no timer expiry | Opaque random token, rotates on every use |

A session stays alive until the user explicitly logs out, resets their password, or **logs in
on another device** (§3.6) — there's no 30-day (or any) idle clock. The short-lived access
token is renewed transparently in the background (§3.3), so an active user is never bounced to
the login screen.

Refresh tokens **rotate**: each call to `/auth/refresh` invalidates the old refresh token and
issues a brand-new pair. Store whatever refresh token you most recently received — reusing an
old one after it's been rotated returns `401 Invalid or expired refresh token`.

### 3.3 Automatic silent-refresh (important — build this into your HTTP client)

The server does **not** require you to manually catch every 401 and call `/auth/refresh`
yourself. Send your refresh token on the `x-refresh-token` request header alongside every
authenticated call:

```
Authorization: Bearer <accessToken>
x-refresh-token: <refreshToken>
```

If the access token has merely **expired** (not tampered with), the server:
1. Transparently rotates the refresh token,
2. Lets the original request through as if it had succeeded normally,
3. Returns the **new** pair on response headers:

```
x-access-token: <new access token>
x-refresh-token: <new refresh token>
```

Your client must read these two response headers on every response and, if present, persist
them as the new current token pair. If `x-refresh-token` is missing/invalid, you still get a
normal `401` and must send the user back to login.

**Recommended Kotlin/OkHttp implementation** — an `Interceptor` (not an `Authenticator`, since
the server handles the retry server-side — you just need to attach the header and read the
response):

```kotlin
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val access = tokenStore.accessToken
        val refresh = tokenStore.refreshToken

        val request = chain.request().newBuilder().apply {
            if (access != null) addHeader("Authorization", "Bearer $access")
            if (refresh != null) addHeader("x-refresh-token", refresh)
        }.build()

        val response = chain.proceed(request)

        response.header("x-access-token")?.let { tokenStore.accessToken = it }
        response.header("x-refresh-token")?.let { tokenStore.refreshToken = it }

        return response
    }
}
```

### 3.4 Auth endpoints

All `@Public()` — no `Authorization` header needed.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ email, name, password }` | `{ user }` |
| POST | `/auth/verify-email` | `{ email, code }` | `{ user, tokens }` |
| POST | `/auth/resend-otp` | `{ email }` | `null` |
| POST | `/auth/login` | `{ identifier, password }` | `{ user, tokens }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | `null` |
| POST | `/auth/forgot-password` | `{ email }` | `null` (always 200, doesn't leak whether the email exists) |
| POST | `/auth/reset-password` | `{ email, code, newPassword }` | `null` (also revokes every existing session) |

`identifier` in login accepts **either email or username**.

**Password rule:** 4–72 chars, no other requirement — any character mix is accepted (`1234`
is a valid password). Enforced client-side UX (strength meter, etc.) is up to the app; the
server itself doesn't require complexity.
**OTP:** **4 digits** (numeric), expires in 10 minutes, max 5 attempts before you must request a new one.

Example — register:

```json
POST /auth/register
{ "email": "jane@example.com", "name": "Jane Doe", "password": "Str0ng!Pass" }
```

Example — token pair shape (from `verify-email`, `login`, or `refresh`):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a4de2d1467c901f6315db0f04b320d4..."
}
```

Note: **usernames are auto-generated** from the email's local-part at registration (e.g.
`jane@example.com` → `jane`, or `jane4821` on collision). Users can change it later via
`PATCH /users/me`.

**Right after a successful login/verify-email**, also register the device's FCM token
(`POST /users/me/device-tokens` — see §10.1) so push notifications can reach this device.

### 3.5 Abuse protection — build these into your UI, not just the happy path

| Behavior | Trigger | Response | Client handling |
|---|---|---|---|
| **Rate limit** | > 5 requests/min from the same IP to `login`, `register`, `resend-otp`, `forgot-password`, or `reset-password` | `429`, `message: "ThrottlerException: Too Many Requests"` | Show a generic "too many attempts, try again shortly" — don't retry automatically in a loop |
| **Login lockout** | 5 wrong-password attempts for the same email/username within 15 min | `401`, `message: "Too many failed login attempts. Please try again in a few minutes."` | Distinguish this from a normal wrong-password `401` by checking the message text, and disable the login button for a bit rather than letting the user hammer retry |
| **OTP resend cooldown** | Calling `resend-otp` (or triggering a new code via `forgot-password`) again within 60s of the last one | `400`, `message: "Please wait a moment before requesting another code."` | Disable the "Resend code" button for 60s after each send rather than waiting for this error |
| **Logout is immediate** | `POST /auth/logout` | — | The access token you were using is invalidated **immediately** (not just at its natural 8h expiry) — any request made with it afterward returns `401`, `message: "Session has been logged out"`. Clear tokens from local storage right after a successful logout call. |

None of these are bugs — they're intentional abuse protection. Build UI copy for the lockout
and cooldown messages specifically (don't just show a generic "error occurred").

### 3.6 Single active device — one session at a time

A user can be logged in on **exactly one device**. When the same account logs in elsewhere
(`POST /auth/login`, or the implicit login in `POST /auth/verify-email`), the previous device
is signed out:

- Its next authenticated request — a normal REST call **or** a silent-refresh attempt (§3.3) —
  returns `401`, `message: "Logged in on another device"`.
- Its refresh token is dead immediately: `POST /auth/refresh` with it returns
  `401 Invalid or expired refresh token`.
- Its registered FCM token is dropped server-side, so push notifications follow the new device.

Treat the `"Logged in on another device"` 401 as its own case — clear the local token store and
show a "You've been signed out because your account was used on another device" screen, not a
generic error and not a silent retry loop. A second login **always wins**; there is no way to
keep two devices signed in at once.

Right after every successful login / verify-email, (re-)register the FCM token
(`POST /users/me/device-tokens`, §10.1) — the server keeps only the most recently registered
token per user.

### 3.7 Login history — "recent logins" / "where you're signed in"

Every successful sign-in is recorded (who, from where, when). Read the caller's own list for
a security screen.

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/auth/login-history` | `?cursor&limit` (**auth required** — send the `Authorization` header) | Paginated `LoginEvent[]`, newest first |

`LoginEvent`:

```json
{
  "id": 128,
  "method": "PASSWORD",
  "ipAddress": "203.0.113.5",
  "userAgent": "ConnectX-Android/1.4 (Pixel 7)",
  "isCurrent": true,
  "createdAt": "2026-09-09T17:25:13.267Z"
}
```

- `method` — `"PASSWORD"` (normal `POST /auth/login`) or `"EMAIL_VERIFICATION"` (the implicit
  login right after `POST /auth/verify-email`).
- `ipAddress` — best-effort from the request; may be a carrier/proxy address, or `null`.
- `userAgent` — the raw `User-Agent` your client sent on the login request (`null` if none).
  Send a meaningful UA (e.g. `ConnectX-Android/<version> (<device model>)`) so this screen is
  readable.
- `isCurrent` — `true` for the entry that opened the session you're using right now ("This
  device"). Since only one session is active at a time (§3.6), at most one row is `isCurrent`.
- Rows are **append-only** — token refresh / silent-refresh does not add one (same session
  continuing, not a new login). Deleting your account removes them all.
- Paginate exactly like every other list — §4.

---

## 4. Pagination

Every "list" endpoint uses **cursor pagination** (not page numbers) — stable under
concurrent inserts, good for infinite-scroll `RecyclerView`s.

Query params: `?cursor=<id>&limit=<n>` (limit defaults to 20, max 50).

Response shape:

```json
{
  "items": [ /* ... */ ],
  "nextCursor": 42,
  "hasMore": true
}
```

To load the next page, pass `nextCursor` as `cursor` on the following request. `nextCursor` is
`null` when there's nothing more.

**One exception:** `GET /posts/feed` and `GET /posts/user/:username` interleave posts and
reshares, so their `cursor`/`nextCursor` is an **opaque string**, not a number. Treat it as
a token — pass `nextCursor` back verbatim as `cursor`, don't parse it. Everything else uses
the numeric id cursor above.

---

## 5. Users

Auth required except `GET /users/:username`.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/users` | `?cursor&limit` | Paginated `PublicUserSummary[]` — every active user except you and anyone blocked either way |
| GET | `/users/me` | — | Full `User` (your own, unfiltered) |
| PATCH | `/users/me` | `{ name?, username?, bio?, gender?, dateOfBirth?, phoneNumber? }` | Updated `User` |
| PATCH | `/users/me/phone` | `{ phoneNumber }` (required) | Updated `User` |
| PATCH | `/users/me/privacy` | `{ profilePhotoPrivacy?, lastSeenPrivacy?, onlineStatusPrivacy?, isPrivate? }` | Updated `User` |
| POST | `/users/me/avatar` | multipart `file` | Updated `User` |
| DELETE | `/users/me/avatar` | — | Updated `User` |
| POST | `/users/me/cover` | multipart `file` (JPEG/PNG/WEBP, ≤5 MB) | Updated `User` (`coverUrl` set) |
| DELETE | `/users/me/cover` | — | Updated `User` (`coverUrl` null) |
| DELETE | `/users/me` | `{ password }` (required) | `null` — soft-deletes your account (see **§5.2**) |
| GET | `/users/:username` | — (**auth now required**) | `PublicProfile` — the profile-screen payload: user info + counts + your follow relationship |

Profile "About" tab — see **§5.1**.

**Phone numbers** accept either local (`01712345678`) or international (`+8801712345678`)
format — both validate against Bangladesh's numbering plan. `phoneNumber` is globally unique;
claiming one already taken by another account returns `409 Phone number is already in use`.
`PATCH /users/me/phone` exists as a dedicated endpoint alongside the general `PATCH /users/me`
(which also still accepts `phoneNumber`) for a focused "change phone number" screen — both
enforce the same validation and uniqueness rule.

`PublicProfile` — everything the profile screen needs in one call (privacy-filtered:
`avatarUrl` / `isOnline` / `lastSeenAt` come back `null` if the target's privacy setting
hides them from you):

```json
{
  "id": 7,
  "username": "jane",
  "name": "Jane Doe",
  "bio": "hello!",
  "gender": "FEMALE",
  "avatarUrl": "/uploads/avatars/....jpg",
  "coverUrl": "/uploads/covers/....jpg",
  "isPrivate": false,
  "isOnline": true,
  "lastSeenAt": "2026-08-17T12:00:00.000Z",
  "followersCount": 128,
  "followingCount": 87,
  "postsCount": 34,
  "followState": "ACCEPTED",
  "followsYou": true
}
```

`coverUrl` is shown to everyone (a banner) — not filtered by `profilePhotoPrivacy`.
`followState` (`"NONE" | "PENDING" | "ACCEPTED"`) is *your* relationship to this user —
render the Follow / Requested / Following button from it; it's `"NONE"` on your own
profile. `followsYou` = they follow you back (accepted). Tapping a username anywhere in the
app should call this endpoint with that username and open the profile screen from the
result — **don't** build the profile object from the embedded `PublicUserSummary` alone.

**Note:** `PrivacyLevel.FOLLOWERS` is accepted by the API but currently has no follow-system
enforcement yet — treated the same as `NOBODY` server-side. Don't build UI that promises
"visible to followers only" behaves differently from "hidden" yet.

### 5.1 Profile "About" tab (`/users/me/*`, `/users/:username/about`) — auth required

A LinkedIn-style structured profile. Read the whole tab in one call; edit piece by piece.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/users/:username/about` | — (use `me` or your own username for the owner view) | `{ about, education[], experience[], featured[] }` |
| PUT | `/users/me/about` | `{ headline?, currentCity?, hometown?, relationship?, website?, languages? }` — all optional, upsert | `ProfileAbout` |
| POST | `/users/me/education` | `{ institution, degree?, fieldOfStudy?, startYear?, endYear?, isCurrent?, description? }` | `ProfileEducation` |
| PATCH | `/users/me/education/:id` | any subset of the above | Updated `ProfileEducation` |
| DELETE | `/users/me/education/:id` | — | `null` |
| POST | `/users/me/experience` | `{ title, company, location?, startDate?, endDate?, isCurrent?, description? }` | `ProfileExperience` |
| PATCH | `/users/me/experience/:id` | any subset | Updated `ProfileExperience` |
| DELETE | `/users/me/experience/:id` | — | `null` |
| POST | `/users/me/featured` | `{ title, url?, imageUrl?, note?, position? }` | `ProfileFeatured` |
| PATCH | `/users/me/featured/:id` | any subset | Updated `ProfileFeatured` |
| DELETE | `/users/me/featured/:id` | — | `null` |

- `relationship` ∈ `SINGLE | IN_A_RELATIONSHIP | ENGAGED | MARRIED | COMPLICATED | PREFER_NOT_TO_SAY`.
- `startYear`/`endYear` are plain integers (1950–2100); `startDate`/`endDate` are ISO dates.
- `featured` items render in ascending `position` order — send `position` to reorder.
- `GET …/about` honours the target's private-account setting + blocks (same rules as their
  posts). Editing an entry that isn't yours returns `404`.
- The whole tab may be empty — `about` is `null` until first `PUT`, the lists are `[]`.

### 5.2 Delete account (`DELETE /users/me`) — auth required

For the "Delete my account" screen. **Soft delete** — send the current password in the body:

```
DELETE /users/me
Authorization: Bearer <access token>
Content-Type: application/json

{ "password": "<current password>" }
```

| Response | Meaning |
|---|---|
| `200` `{ message: "Account deleted successfully", data: null }` | Done — clear all local tokens and return to the login/onboarding screen. |
| `401` `"Password is incorrect"` | Wrong password — keep the dialog open, let them retry. |
| `400` `["password must be a string", …]` | Password field missing/empty. |

What happens server-side:

- The account row **and all of the user's content** (posts, comments, messages, group
  membership) are kept, but `isActive` flips to `false` and `deletedAt` is stamped.
- **Every session dies immediately**: the access token you called this with stops working on
  its next request (`401`), all refresh tokens are revoked (`POST /auth/refresh` → `401`
  `"Invalid or expired refresh token"`), and every registered device token is removed — no
  further push reaches this account. No separate `POST /auth/logout` call is needed.
- The user disappears from `GET /users`, search, suggestions, and `GET /users/:username`
  (now `404 "User not found"`).
- Logging back in returns `401 "This account has been deactivated"`.
- The email and username stay reserved — that email **cannot** register a new account, and
  there is no in-app reactivation (an admin/support action is required to restore it). Warn
  the user of this in the confirmation dialog.

Always gate this behind a confirmation dialog that requires re-typing the password.

> Retrofit note: this is a `DELETE` **with a body** — declare it as
> `@HTTP(method = "DELETE", path = "users/me", hasBody = true)` with a `@Body` param, not
> `@DELETE`, or the password won't be sent.

---

## 6. Social

### 6.1 Follow (`/follow`) — auth required

| Method | Path | Query/Body | Returns |
|---|---|---|---|
| GET | `/follow/requests/incoming` | `?cursor&limit` | Paginated `PublicUserSummary[]` — pending requests sent to you |
| POST | `/follow/requests/:username/accept` | — | `null` |
| POST | `/follow/requests/:username/reject` | — | `null` |
| GET | `/follow/:username/followers` | `?cursor&limit` | Paginated `PublicUserSummary[]` |
| GET | `/follow/:username/following` | `?cursor&limit` | Paginated `PublicUserSummary[]` |
| POST | `/follow/:username` | — | `{ status: "ACCEPTED" \| "PENDING" }` |
| DELETE | `/follow/:username` | — | `null` — unfollows, or cancels a request you sent |

Following a **private account** returns `status: "PENDING"` and the target must accept it.
Following a public account returns `status: "ACCEPTED"` immediately.

### 6.2 Block (`/block`) — auth required

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/block` | `?cursor&limit` | Paginated `PublicUserSummary[]` |
| POST | `/block/:username` | — | `null` (also un-follows in both directions) |
| DELETE | `/block/:username` | — | `null` |
| POST | `/block/:username/report` | `{ reason, details? }` | `null` |

`reason` ∈ `SPAM \| HARASSMENT \| FAKE_ACCOUNT \| INAPPROPRIATE_CONTENT \| OTHER`.

### 6.3 Search (`/search`) — auth required

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/search/users` | `?q=<term>&cursor&limit` | Paginated `SearchUserResult[]` |

```json
{
  "id": 2,
  "username": "jane",
  "name": "Jane Doe",
  "avatarUrl": null,
  "followState": "NONE"
}
```

`followState` ∈ `NONE \| PENDING \| ACCEPTED` — lets you render the right follow-button state
without an extra round trip per row.

### 6.4 Suggested users — "People you may know" — auth required

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/suggestions/users` | `?limit` (default 10, max 30) | `SearchUserResult[]` — a plain array, **not** paginated |

A random set of active users the caller has no relationship with yet — not already followed,
no pending request either way, not blocked either way, not themselves. Meant for the
post-signup "follow a few people" step and a discover screen. There's no cursor: call it again
for a fresh random set. Each item carries `followState` (always `"NONE"` here) so you can reuse
the exact follow-button component from `/search/users` — tapping Follow just calls
`POST /follow/:username` (§6.1), which returns `ACCEPTED` or `PENDING` as usual.

```json
[
  { "id": 12, "username": "rahim", "name": "Rahim", "avatarUrl": null, "followState": "NONE" }
]
```

---

## 7. Chat

### 7.1 Conversations (`/conversations`) — auth required

| Method | Path | Body/Query | Returns |
|---|---|---|---|
| GET | `/conversations` | `?cursor&limit` | Paginated `ConversationSummary[]` |
| POST | `/conversations/direct/:username` | — | `Conversation` (existing DM reused, or created) |
| GET | `/conversations/:id/messages` | `?cursor&limit` | Paginated `MessageResponse[]` |
| POST | `/conversations/:id/messages` | `SendMessageDto` | `MessageResponse` |
| GET | `/conversations/:id/pinned` | — | `MessageResponse[]` |
| POST | `/conversations/:id/read` | — | `null` — marks everything read, notifies other side |

`ConversationSummary`:

```json
{
  "id": 5,
  "type": "DIRECT",
  "otherParticipant": { "id": 2, "username": "jane", "name": "Jane", "avatarUrl": null },
  "group": null,
  "lastMessage": { "...": "MessageResponse or null" },
  "unreadCount": 3,
  "updatedAt": "2026-08-17T12:00:00.000Z"
}
```

For a `GROUP` conversation, `otherParticipant` is `null` and `group` is populated instead:

```json
"group": {
  "name": "Weekend Trip",
  "description": null,
  "imageUrl": null,
  "rules": null,
  "announcement": null,
  "participantCount": 4,
  "myRole": "MEMBER"
}
```

`SendMessageDto` (body of `POST /conversations/:id/messages`):

```json
{
  "type": "TEXT",
  "text": "hey!",
  "replyToId": null
}
```

Fields depend on `type`:

| type | required fields |
|---|---|
| `TEXT` | `text` |
| `IMAGE` / `VIDEO` / `VOICE` / `FILE` | `mediaUrl` (from `/chat/media` upload), optionally `mediaMimeType`, `mediaSizeBytes`, `mediaDurationSeconds`, `fileName`, and `text` as a caption |
| `LOCATION` | `latitude`, `longitude`, optionally `locationName` |
| `CONTACT` | `contactName`, `contactPhone` |

`replyToId`, if provided, must be a real message id (`>= 1`) in the same conversation — omit it
entirely rather than sending `0` or `null`.

`MessageResponse` (returned by send/edit/history/pinned/starred/forward):

```json
{
  "id": 101,
  "conversationId": 5,
  "sender": { "id": 1, "username": "me", "name": "Me", "avatarUrl": null },
  "type": "TEXT",
  "text": "hey!",
  "mediaUrl": null, "mediaMimeType": null, "mediaSizeBytes": null,
  "mediaDurationSeconds": null, "fileName": null,
  "latitude": null, "longitude": null, "locationName": null,
  "contactName": null, "contactPhone": null,
  "mentionedUserIds": [],
  "systemData": null,
  "replyToId": null,
  "forwardedFromId": null,
  "isEdited": false,
  "isPinned": false,
  "isStarredByMe": false,
  "deletedForEveryone": false,
  "status": "SENT",
  "createdAt": "2026-08-17T12:00:00.000Z",
  "updatedAt": "2026-08-17T12:00:00.000Z"
}
```

`status` (`SENT \| DELIVERED \| SEEN \| null`) is only meaningful **to the sender** — it's the
weakest receipt status across all recipients (WhatsApp-style group tick behavior). It's always
`null` when you're not the sender.

### 7.2 Messages (`/messages`) — auth required

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/messages/starred` | `?cursor&limit` | Paginated `MessageResponse[]` |
| POST | `/messages/send` | `SendMessageDto` + `{ toUsername? }` or `{ toConversationId? }` | `MessageResponse` |
| PATCH | `/messages/:id` | `{ text }` | Updated `MessageResponse` |
| DELETE | `/messages/:id/me` | — | `null` — hides it for you only |
| DELETE | `/messages/:id/everyone` | — | `null` — within 15 min of sending, own messages only |
| POST | `/messages/:id/pin` | — | `null` |
| DELETE | `/messages/:id/pin` | — | `null` |
| POST | `/messages/:id/star` | — | `null` |
| DELETE | `/messages/:id/star` | — | `null` |
| POST | `/messages/:id/forward` | `{ toUsername? }` or `{ toConversationId? }` | `MessageResponse` |

Edit/delete-for-everyone are only allowed within **15 minutes** of sending, and only your own
messages — the server enforces this, don't rely on client-side hiding of the button alone.

**`POST /messages/send`** is a convenience one-shot endpoint that combines "find-or-create the
direct conversation" + "send" for person-to-person chat, or sends straight into an existing
conversation id (e.g. a group) — so the client doesn't need to call
`POST /conversations/direct/:username` first just to get an id. Body is the normal
`SendMessageDto` (see §7.1) plus **exactly one** of:

```json
{ "type": "TEXT", "text": "hey!", "toUsername": "jane" }
```
```json
{ "type": "TEXT", "text": "hello team!", "toConversationId": 5 }
```

Providing neither (or providing garbage placeholder values instead of omitting unused fields —
e.g. leaving `replyToId: 0` from a Swagger "Try it out" template) returns a `400`, not a silent
no-op. Only send the fields your message `type` actually needs; omit the rest rather than
sending `0`/`"string"` placeholders.

### 7.3 Groups (`/groups`) — auth required

**Roles:** `OWNER` (the creator, or whoever ownership was transferred to — exactly one,
can't be removed/demoted, the only one who can delete the group or transfer ownership),
`ADMIN`, `MEMBER`. "Admin only" below means **OWNER or ADMIN**.

**Permissions** (`GroupDetails.permissions`, set via `PATCH /groups/:id/permissions`):
`sendMessagesPolicy` (`ADMINS_ONLY` = announcement group), `editInfoPolicy` (name / desc /
icon), `addMembersPolicy` — each `EVERYONE | ADMINS_ONLY` — plus `approveNewMembers` (bool:
invite-link joins wait for admin approval). New groups default to `EVERYONE` / approval off.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/groups` | `{ name, description?, participantUsernames: string[] }` | `GroupDetails` (you become OWNER) |
| GET | `/groups/:id` | — | `GroupDetails` — full profile; `inviteLink` & `pendingJoinRequestCount` are `null` unless you're an admin |
| PATCH | `/groups/:id` | `{ name?, description?, rules?, announcement? }` | `GroupDetails` (gated by `editInfoPolicy`) |
| PATCH | `/groups/:id/permissions` | `{ sendMessagesPolicy?, editInfoPolicy?, addMembersPolicy?, approveNewMembers? }` | `GroupDetails` (admin only) |
| POST | `/groups/:id/image` | multipart `file` | `GroupDetails` (gated by `editInfoPolicy`) |
| DELETE | `/groups/:id/image` | — | `GroupDetails` |
| DELETE | `/groups/:id` | — | `null` (**owner only**) |
| GET | `/groups/:id/members` | `?cursor&limit` | Paginated `GroupMemberSummary[]` (owner → admins → members) |
| POST | `/groups/:id/members` | `{ usernames: string[] }` | `null` (gated by `addMembersPolicy`) |
| DELETE | `/groups/:id/members/:username` | — | `null` (admin only; owner can't be removed) |
| POST | `/groups/:id/members/:username/promote` | — | `null` (admin only) |
| POST | `/groups/:id/members/:username/demote` | — | `null` (admin only; owner can't be demoted) |
| POST | `/groups/:id/members/:username/transfer-ownership` | — | `null` (**owner only** — target becomes OWNER, you become ADMIN) |
| POST | `/groups/:id/leave` | — | `null` (if you're the owner, ownership auto-passes to the senior-most remaining member) |
| GET | `/groups/:id/invite-code` | — | `{ code, enabled }` (admin only; generates a code if none) |
| POST | `/groups/:id/invite-code` | — | `{ code, enabled }` (admin only — rotates + enables) |
| PATCH | `/groups/:id/invite-code` | `{ enabled }` | `{ enabled }` (admin only — turn the link on/off without changing the code) |
| GET | `/groups/join/:code` | — | `{ id, name, imageUrl, memberCount, approveNewMembers }` — preview before joining |
| POST | `/groups/join/:code` | — | `{ status: "JOINED" \| "REQUESTED" \| "ALREADY_MEMBER", group? }` |
| GET | `/groups/:id/requests` | `?cursor&limit` | Paginated `GroupJoinRequestSummary[]` (`PublicUserSummary` + `requestedAt`) — admin only |
| POST | `/groups/:id/requests/:username/approve` | — | `null` (admin only — adds them) |
| POST | `/groups/:id/requests/:username/reject` | — | `null` (admin only) |
| DELETE | `/groups/:id/requests/me` | — | `null` — cancel your own pending request |

Max 256 members per group. `GroupMemberSummary` = `PublicUserSummary` + `role`
(`MEMBER \| ADMIN \| OWNER`).

**System messages.** Every group action writes a persisted `MessageResponse` with
`type: "SYSTEM"` into the chat timeline (so offline members catch up): `systemData` is
`{ event, actorId, targetIds?, value? }` and `text` is a ready-to-show English fallback
(`"Alice added Bob"`). `event` ∈ `GROUP_CREATED | MEMBERS_ADDED | MEMBER_REMOVED |
MEMBER_LEFT | MEMBER_JOINED | ADMIN_PROMOTED | ADMIN_DEMOTED | OWNERSHIP_TRANSFERRED |
NAME_CHANGED | DESCRIPTION_CHANGED | ICON_CHANGED | ICON_REMOVED | SETTINGS_CHANGED`.
Render them centred/greyed; they can't be edited, deleted-for-everyone, pinned, starred or
forwarded. In an announcement group (`sendMessagesPolicy: ADMINS_ONLY`) a non-admin's
`POST /messages/send` / `POST /conversations/:id/messages` returns `403`.

### 7.4 Chat media upload (`/chat/media`) — auth required

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/chat/media` | multipart `file` | `{ url, mimeType, sizeBytes, fileName }` |

Two-step flow for media messages: upload here first to get a `url`, then send a normal
`POST /conversations/:id/messages` with `type: "IMAGE"` (etc.) referencing that `url`.

- Max size: **50 MB**
- Allowed: any `image/*`, `video/*`, `audio/*`, plus `application/pdf`, `.doc`, `.docx`,
  `.zip`, `text/plain`

Avatar (`/users/me/avatar`) and group image (`/groups/:id/image`) uploads are stricter:
**5 MB max**, JPEG/PNG/WEBP only.

Uploaded files are served statically at `http://<host>:3000/uploads/<path>` — the `url` values
returned above are relative; prefix them with the base host to load in an `ImageView`/Coil/Glide.

### 7.5 Chat polls

A poll is a message: `type: "POLL"` on the normal send endpoints, no separate "create
poll" call.

```json
POST /messages/send
{
  "type": "POLL",
  "toConversationId": 5,
  "question": "Lunch today?",
  "pollOptions": ["Biryani", "Pizza", "Not hungry"],
  "allowMultipleAnswers": false,
  "pollClosesAt": "2026-09-05T12:00:00.000Z"
}
```

`pollOptions` needs 2–10 items. `question` is also copied into `text` as a fallback
preview (conversation list / push notification body show `📊 <question>`). Omit
`pollClosesAt` for an open-ended poll.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/messages/:id/poll/vote` | `{ optionIds: number[] }` | Updated `MessageResponse` |
| DELETE | `/messages/:id/poll/vote` | — | Updated `MessageResponse` |

`MessageResponse.poll` (see `PollResponse` in §12) carries the live tally — refetch or
just use the returned message after voting; a `message:new`/edit-style socket push for
other participants isn't sent on vote yet, so **poll a `GET .../messages` refresh or
re-render optimistically** after your own vote until that's added.

`optionIds` must all belong to this poll; more than one id on a single-answer poll (or
voting after `closesAt`) is a `400`. Voting again **replaces** your previous vote, it
doesn't add to it. A poll message can be pinned/starred/deleted like any other message,
but **can't be forwarded** (`400`) — forward the conversation instead.

---

## 8. Calls (LiveKit-backed)

Auth required for all.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/conversations/:id/calls` | `{ type: "AUDIO" \| "VIDEO" }` | `CallResponse` |
| GET | `/calls/history` | `?cursor&limit` | Paginated `CallResponse[]` |
| GET | `/calls/:id/token` | — | `{ url, token, roomName }` — LiveKit credentials |
| POST | `/calls/:id/accept` | — | `null` |
| POST | `/calls/:id/reject` | — | `null` |
| POST | `/calls/:id/end` | — | `null` |
| POST | `/calls/:id/record` | — | `null` (requires LiveKit server configured) |

`CallResponse`:

```json
{
  "id": 9,
  "conversationId": 5,
  "type": "VIDEO",
  "status": "RINGING",
  "initiatedBy": { "id": 1, "username": "me", "name": "Me", "avatarUrl": null },
  "participants": [
    { "id": 2, "username": "jane", "name": "Jane", "avatarUrl": null,
      "status": "INVITED", "joinedAt": null, "leftAt": null }
  ],
  "startedAt": "2026-08-17T12:00:00.000Z",
  "answeredAt": null,
  "endedAt": null,
  "recordingUrl": null
}
```

Flow: `POST /conversations/:id/calls` to ring everyone → `GET /calls/:id/token` to get LiveKit
credentials → connect to `url`/`token` with the **LiveKit Android SDK** (`io.livekit:livekit-android`)
— that SDK handles the actual media transport; this backend only signals ringing/accept/reject/end
and issues the room token. A 2-person call ends for both sides when either leaves; a group call
ends only when the last active participant leaves.

---

## 9. Posts

Auth required for all. A post is text and/or one attached image/video — a follow-based home
feed, likes, comments, and shares, plus the author gets a notification on each interaction
(see §10).

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/posts` | multipart: `text?`, `contentFormat?` (`PLAIN`\|`MARKDOWN`), `file?` (image/video) | `PostResponse` |
| POST | `/posts/poll` | `{ text?, contentFormat?, poll: { question, options: string[] (2-10), allowMultipleAnswers?, closesAt? } }` | `PostResponse` — a poll post, no file. See §9.4 |
| POST | `/posts/:id/poll/vote` | `{ optionIds: number[] }` | Updated `PostResponse` |
| DELETE | `/posts/:id/poll/vote` | — | Updated `PostResponse` |
| POST | `/posts/tag-suggestions` | `{ text }` (the draft body) | `HashtagSuggestion[]` — `{ tag, postCount }`, best first (max 10). Local keyword match, no LLM. Call it when the composer loses focus / on a "suggest tags" tap. |
| GET | `/posts/feed` | `?cursor&limit` | Paginated `PostResponse[]` — posts **and reshares** by people you follow + your own, interleaved newest-first. **Opaque string cursor** (§4). |
| GET | `/posts/user/:username` | `?cursor&limit` | Paginated `PostResponse[]` — one profile's authored posts **and reshares** (private-account rules apply, §6.1). **Opaque string cursor** (§4). |
| GET | `/posts/user/:username/photos` | `?cursor&limit` | Paginated `PhotoItem[]` — `{ postId, url, createdAt }` for every image the user attached to a post, newest first. Numeric cursor. |
| GET | `/posts/hashtag/:tag` | `?cursor&limit` | Paginated `PostResponse[]` — every post using `#tag` whose author you're allowed to see, newest first. `:tag` with or without a leading `#`, case-insensitive. |
| GET | `/posts/:id` | — | `PostResponse` |
| PATCH | `/posts/:id` | `{ text, contentFormat? }` | Updated `PostResponse` (text only, owner only) — re-extracts hashtags/mentions/link |
| DELETE | `/posts/:id` | — | `null` (owner only) |
| POST | `/posts/:id/like` | — | `null` |
| DELETE | `/posts/:id/like` | — | `null` |
| POST | `/posts/:id/share` | `{ comment? }` | `null` — reshares onto your profile + your followers' feeds, and notifies the author |
| DELETE | `/posts/:id/share` | — | `null` — removes the reshare everywhere |
| GET | `/posts/:id/comments` | `?cursor&limit` | Paginated `CommentResponse[]` — **top-level only**, newest first |
| POST | `/posts/:id/comments` | `{ text, parentId? }` | `CommentResponse` — `parentId` set = a reply (to a comment *or* a reply, any depth) |
| GET | `/comments/:id/replies` | `?cursor&limit` | Paginated `CommentResponse[]` — direct replies to one comment, oldest first |
| PATCH | `/comments/:id` | `{ text }` | `CommentResponse` (own comment, within 60 min) |
| DELETE | `/comments/:id` | — | `null` (own comment only; replies + reactions cascade) |
| POST | `/comments/:id/reactions` | `{ reaction: "LIKE" \| "DISLIKE" }` | `CommentResponse` — upsert (calling again with the other value switches it) |
| DELETE | `/comments/:id/reactions` | — | `CommentResponse` — clears your reaction |
| GET | `/hashtags/trending` | — | `TrendingHashtag[]` — `{ tag, postCount }`, most posts in the last 48h first (max 20) |
| GET | `/hashtags/search` | `?q=` (required, prefix, `#` optional) | `HashtagSuggestion[]` — `{ tag, postCount }`, most-used first (max 10) — composer autocomplete |

`PostResponse`:

```json
{
  "id": 1,
  "author": { "id": 8, "username": "jane", "name": "Jane", "avatarUrl": null },
  "text": "# Trip notes\n\nWent to **Sylhet** with @rahim — tea gardens everywhere. #travel #sylhet\nhttps://example.com/sylhet",
  "contentFormat": "MARKDOWN",
  "repost": null,
  "mediaUrl": null,
  "mediaType": null,
  "hashtags": ["sylhet", "travel"],
  "mentions": [{ "id": 12, "username": "rahim", "name": "Rahim", "avatarUrl": null }],
  "linkPreview": {
    "url": "https://example.com/sylhet",
    "title": "A weekend in Sylhet",
    "description": "Tea gardens, waterfalls, and the best seven-layer tea.",
    "imageUrl": "https://example.com/sylhet/cover.jpg",
    "siteName": "Example Travel"
  },
  "lang": "en",
  "readingTimeMinutes": 1,
  "excerpt": "Trip notes Went to Sylhet with @rahim — tea gardens everywhere. travel sylhet https://example.com/sylhet",
  "likesCount": 1,
  "commentsCount": 1,
  "sharesCount": 1,
  "isLikedByMe": true,
  "isSharedByMe": false,
  "communityId": null,
  "isPinnedInCommunity": false,
  "poll": null,
  "createdAt": "2026-08-21T13:32:11.744Z",
  "updatedAt": "2026-08-21T13:32:11.744Z"
}
```

`communityId` / `isPinnedInCommunity` are set when the post lives in a Community (§9.5)
instead of the author's own feed. `poll` is set only for a poll post — see §9.4.

**Single-post page:** tapping a post anywhere → `GET /posts/:id` (full `PostResponse`) +
`GET /posts/:id/comments` (top-level comments) is the whole page. `GET /posts/:id` enforces
the same visibility as the feed — private account you don't follow, or private community
you're not in → `404`.

`CommentResponse`:

```json
{
  "id": 4,
  "postId": 1,
  "parentId": null,
  "author": { "id": 8, "username": "jane", "name": "Jane", "avatarUrl": null },
  "text": "nice one",
  "isEdited": false,
  "likeCount": 3,
  "dislikeCount": 0,
  "myReaction": "LIKE",
  "replyCount": 2,
  "createdAt": "2026-09-07T13:32:23.782Z"
}
```

`parentId` null = top-level; set = a reply pointing at the comment it answers. `myReaction`
is `"LIKE" | "DISLIKE" | null`. Replies of a reply are supported (arbitrary depth) — walk
`GET /comments/:id/replies` per thread; the client decides how deep to visually nest.
Comments work identically on personal posts and community posts; deleting a comment removes
its whole reply subtree. A reply notifies the parent-comment author (`COMMENT_REPLY`) and,
if different, the post author (`POST_COMMENT`); a `LIKE` on a comment notifies its author
(`COMMENT_LIKE`) — a `DISLIKE` notifies no one.

**Rich content.** `contentFormat` defaults to `PLAIN` — send `MARKDOWN` to opt into a
CommonMark subset (headings, bold, italic, ordered/unordered lists, block quotes, inline +
fenced code, links). The server stores raw text and never returns HTML — render Markdown
client-side (Android: [Markwon](https://github.com/noties/Markwon)). Max body **10 000 chars**.

- `hashtags` — every `#tag` in the text (any script, so `#বাংলা` works), normalised to
  lowercase, no `#`. Extracted for `PLAIN` too. Use for `GET /posts/hashtag/:tag`.
- `mentions` — `@username` tokens resolved to real, non-blocked users. Unresolved mentions
  stay as plain text and don't appear here. Each newly-mentioned user gets a `POST_MENTION`
  notification (§10). Render tappable chips from this array; the raw `@username` is still in
  `text` at the same position.
- `linkPreview` — Open Graph card for the **first** URL in the text, or `null` (no URL, fetch
  failed, or not HTML). Any field inside may be `null`. Fetched once on create; on edit only
  re-fetched if the first URL changed.
- `lang` — server-detected: `bn` \| `en` \| `hi` \| `bn-Latn` (Banglish) \| `unknown` \|
  `null`. Same detector the translate feature uses — pairs with §12 (message translate).
- `readingTimeMinutes` / `excerpt` — derived from the text (excerpt has Markdown stripped),
  for feed-card previews. `null` when there's no text.
- `repost` — `null` for an original post. On a reshare it's
  `{ by: PublicUserSummary, comment: string | null, at }` — **the rest of the object still
  describes the original post** (`author`, `text`, `id`, counts…). Render it as
  "<by.name> reshared" above the original card, plus `comment` if present.

A post needs `text` or `file` (or both) — an empty post is rejected with `400`. `file` accepts
`image/*` or `video/*`, max **50 MB**, same multipart pattern as avatar/group-image uploads
(`FileInterceptor`), just a single combined create call rather than chat's two-step
upload-then-reference flow. Liking/commenting/sharing your own post is allowed but never
notifies you (self-notifications are always suppressed — see §10).

**Share / reshare.** `POST /posts/:id/share` is a toggle (like/unlike style) that notifies
the author **and** now surfaces the post as a reshare: it appears in your profile's Posts
tab and in your followers' `GET /posts/feed`, with `repost` populated. `DELETE /posts/:id/share`
removes it everywhere. A reshare only exposes a post whose original author the viewer is
allowed to see; a post that would appear twice (you authored it *and* someone reshared it,
or several people reshared it) is shown once, at its most recent point in the timeline.
It is still not a quote-post — there's one row per (post, sharer), and editing the caption
is just calling `share` again.

### 9.4 Polls on posts

```json
POST /posts/poll
{
  "text": "What should we build next?",
  "poll": {
    "question": "Pick one",
    "options": ["Stories", "Live streaming", "Message reactions"],
    "allowMultipleAnswers": false
  }
}
```

`text` is an optional caption shown above the poll (still runs through the normal
hashtag/mention/Markdown pipeline). No `file` — a poll post is text + poll only; attach
media to a regular post instead. Same vote endpoints and rules as chat polls (§7.5):
`optionIds` must belong to the poll, `>1` id on a single-answer poll or voting after
`closesAt` is a `400`, voting again replaces your previous vote. `PollResponse` shape is
identical for posts and chat messages — see §12.

### 9.5 Communities (`/communities`) — auth required

A **Community** is a LinkedIn/Facebook-Group-style space — its own membership and post
feed — distinct from a chat group (which is *messaging*). Roles and the join-request flow
mirror chat groups (§7.3) almost exactly: `OWNER` (creator, can't be removed/demoted, only
one who deletes/transfers), `ADMIN`, `MEMBER`; `visibility` `PUBLIC | PRIVATE` controls who
can see the member list and posts (PUBLIC = any signed-in user, PRIVATE = members only);
joining a PRIVATE community always creates a request, a PUBLIC one only if
`approveNewMembers` is on.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/communities` | `{ name, description?, rules?, visibility? }` | `CommunityDetails` (you become OWNER; `slug` is generated from `name`) |
| GET | `/communities` | `?q=&cursor&limit` | Paginated `CommunitySummary[]` — discover PUBLIC communities, optional name search |
| GET | `/communities/mine` | `?cursor&limit` | Paginated `CommunitySummary[]` — communities you're a member of |
| GET | `/communities/:id` | — | `CommunityDetails` — non-members of a PUBLIC community still get the basic card; `pendingJoinRequestCount` is admin-only |
| PATCH | `/communities/:id` | `{ name?, description?, rules? }` | `CommunityDetails` (admin only) |
| PATCH | `/communities/:id/permissions` | `{ postPermission?, approveNewMembers?, visibility? }` | `CommunityDetails` (admin only) |
| DELETE | `/communities/:id` | — | `null` (**owner only**) |
| POST | `/communities/:id/icon` \| `/cover` | multipart `file` | `CommunityDetails` (admin only) |
| DELETE | `/communities/:id/icon` \| `/cover` | — | `CommunityDetails` |
| GET | `/communities/:id/members` | `?cursor&limit` | Paginated `CommunityMemberSummary[]` (owner → admins → members) |
| POST | `/communities/:id/members` | `{ usernames: string[] }` | `null` — admin directly adds people (bypasses the join-request queue) |
| DELETE | `/communities/:id/members/:username` | — | `null` (admin only; owner can't be removed) |
| POST | `/communities/:id/members/:username/promote` \| `/demote` | — | `null` (admin only; owner can't be demoted) |
| POST | `/communities/:id/members/:username/transfer-ownership` | — | `null` (**owner only**) |
| POST | `/communities/:id/leave` | — | `null` (owner leaving auto-passes ownership) |
| POST | `/communities/:id/join` | — | `{ status: "JOINED" \| "REQUESTED" \| "ALREADY_MEMBER" }` |
| GET | `/communities/:id/requests` | `?cursor&limit` | Paginated `CommunityJoinRequestSummary[]` (admin only) |
| POST | `/communities/:id/requests/:username/approve` \| `/reject` | — | `null` (admin only) |
| DELETE | `/communities/:id/requests/me` | — | `null` — cancel your own pending request |
| GET | `/communities/:id/posts` | `?cursor&limit` | Paginated `PostResponse[]` — pinned first, then newest. Requires membership if PRIVATE |
| POST | `/communities/:id/posts` | multipart, same body as `POST /posts` | `PostResponse` (gated by `postPermission`) |
| POST | `/communities/:id/posts/poll` | same body as `POST /posts/poll` | `PostResponse` (gated by `postPermission`) |
| POST | `/communities/:id/posts/:postId/pin` \| `DELETE .../pin` | — | `null` (admin only) |
| DELETE | `/communities/:id/posts/:postId` | — | `null` — admin moderation delete (any member's post) |

`CommunityDetails`:

```json
{
  "id": 3,
  "name": "Android Devs BD",
  "slug": "android-devs-bd",
  "description": "Kotlin & Android talk",
  "rules": null,
  "iconUrl": null,
  "coverImageUrl": null,
  "visibility": "PUBLIC",
  "owner": { "id": 1, "username": "me", "name": "Me", "avatarUrl": null },
  "memberCount": 42,
  "myRole": "OWNER",
  "permissions": { "postPermission": "EVERYONE", "approveNewMembers": false },
  "createdAt": "2026-09-04T12:00:00.000Z",
  "pendingJoinRequestCount": 0
}
```

`myRole` is `null` if you're not a member. `pendingJoinRequestCount` is `null` for
non-admins. `CommunityMemberSummary` = `PublicUserSummary` + `role`
(`MEMBER | ADMIN | OWNER`); `CommunityJoinRequestSummary` = `PublicUserSummary` +
`requestedAt`; `CommunitySummary` (list/mine cards) = a trimmed `CommunityDetails`
(`{ id, name, slug, description, iconUrl, visibility, memberCount, myRole }`).

Posts created inside a community are ordinary `Post` rows with `communityId` set — they
get the full rich-content pipeline (Markdown, hashtags, `@mentions`, link previews,
polls) but **do not** appear in the author's personal feed, profile, or hashtag
discovery; they only show up via `GET /communities/:id/posts`.

---

## 10. Notifications & push

Two different delivery paths, matching how the app already treats chat vs. everything else:

- **Social** (post liked/commented/shared, new follower, follow request, follow accepted) →
  a persisted row in `GET /notifications` **and** a push. Both new.
- **Chat** (direct message, group message) → **push only** — chat already has its own
  read-state tracking (`unreadCount` in §7.1), so it doesn't also clutter the notifications list.

### 10.1 Device token registration — do this right after login

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/users/me/device-tokens` | `{ token, platform? }` (`platform` defaults to `"ANDROID"`) | `null` |
| DELETE | `/users/me/device-tokens/:token` | — | `null` — call on logout |

```kotlin
val token = FirebaseMessaging.getInstance().token.await()
api.post("/users/me/device-tokens", mapOf("token" to token, "platform" to "ANDROID"))
```

Re-registering the same token under a different account (device shared between users, or
re-login) moves ownership rather than erroring — no need to unregister before switching
accounts on the same device, though doing so on logout is still correct practice.

**Server-side note:** push delivery is dormant until `FIREBASE_SERVICE_ACCOUNT_BASE64` is set in
the server's `.env` (see `.env.example`) — until then, registering a token still works (it's
just stored), the server logs what it *would* have sent, and nothing errors. Nothing on the
Kotlin side needs to change when the key is added later.

### 10.2 Notification inbox

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/notifications` | `?cursor&limit` | Paginated `NotificationResponse[]`, newest first |
| GET | `/notifications/unread-count` | — | `{ count }` |
| POST | `/notifications/:id/read` | — | `null` |
| POST | `/notifications/read-all` | — | `null` |

`NotificationResponse`:

```json
{
  "id": 4,
  "type": "POST_COMMENT",
  "actor": { "id": 7, "username": "jane", "name": "Jane", "avatarUrl": null },
  "postId": 1,
  "conversationId": null,
  "commentId": 12,
  "callId": null,
  "text": "Nice post!",
  "isRead": false,
  "createdAt": "2026-08-21T13:32:23.782Z"
}
```

`type` ∈ `NEW_FOLLOWER \| FOLLOW_REQUEST \| FOLLOW_REQUEST_ACCEPTED \| POST_LIKE \|
POST_COMMENT \| POST_SHARE \| POST_MENTION \| COMMENT_REPLY \| COMMENT_LIKE \| MISSED_CALL`.
`text` is only set for `POST_COMMENT` / `POST_SHARE` / `COMMENT_REPLY` (the comment/share
body) — render a type-appropriate sentence for the rest client-side, same as the push body.

**Deep-link targets** — the response carries the ids the client needs to open exactly the
right screen on tap:

| Tap a notification of type… | Open… | Ids provided |
|---|---|---|
| `NEW_FOLLOWER` / `FOLLOW_REQUEST` / `FOLLOW_REQUEST_ACCEPTED` | the `actor`'s profile (`GET /users/<actor.username>`) | `actor` |
| `POST_LIKE` / `POST_SHARE` / `POST_MENTION` | that post's single-post page (`GET /posts/<postId>`) | `postId` |
| `POST_COMMENT` / `COMMENT_REPLY` / `COMMENT_LIKE` | that post, **scrolled/expanded to `commentId`** | `postId`, `commentId` |
| `MISSED_CALL` | the call's conversation / call-back screen | `callId`, `conversationId`, `actor` |

The same ids are on the FCM push `data` payload (all as strings) so a cold-start tap
deep-links too.

A connected client also gets these instantly on the `/presence` socket via `notification:new`
(see §11.2) — poll `GET /notifications`/`unread-count` on reconnect or app-foreground to catch
up on anything missed while disconnected.

---

## 11. Realtime (Socket.IO — not raw WebSocket)

The gateways are built with NestJS's `@nestjs/websockets` on top of **Socket.IO**, so the
Android client needs the Socket.IO client library, not `OkHttp`'s raw WebSocket:

```gradle
implementation("io.socket:socket.io-client:2.1.0") {
    exclude group: "org.json", module: "json"
}
```

### 11.1 Connecting & auth

Three separate namespaces, each needs its own connection, same JWT access token:

```kotlin
val options = IO.Options().apply {
    auth = mapOf("token" to accessToken)   // preferred: auth.token
    // or: extraHeaders = mapOf("Authorization" to listOf("Bearer $accessToken"))
}
val presenceSocket = IO.socket("http://40.81.26.50/presence", options)
val chatSocket = IO.socket("http://40.81.26.50/chat", options)
val callsSocket = IO.socket("http://40.81.26.50/calls", options)
```

(Swap the host for `http://10.0.2.2:3000` or your machine's LAN IP when testing against a
locally-run server instead — see §1. Once a domain + HTTPS is set up, these become `wss://`.)

The server rejects (disconnects) the socket immediately if the token is missing/invalid/expired
— there's no silent-refresh on sockets like there is on REST, so reconnect with a fresh access
token when your REST layer rotates one.

### 11.2 `/presence`

Purely connection-tracked — no client-emitted events. Just connect to make yourself "online"
(multi-device aware: you only go offline once every device disconnects). Other services push
notifications into this namespace's `user:<id>` room:

| Event (server → client) | Payload |
|---|---|
| `follow:request-received` | `PublicUserSummary` (of the requester) |
| `follow:new-follower` | `PublicUserSummary` |
| `follow:request-accepted` | `{ username }` |
| `notification:new` | `NotificationResponse` (§10.2) — fired for every social notification type, one generic event rather than one per type |

### 11.3 `/chat`

| Direction | Event | Payload |
|---|---|---|
| → server | `typing:start` | `{ conversationId }` |
| → server | `typing:stop` | `{ conversationId }` |
| → server | `message:ack-delivered` | `{ messageId }` |
| ← server | `message:new` | `MessageResponse` |
| ← server | `message:mention` | `MessageResponse` (only to @mentioned users in a group) |
| ← server | `message:edited` | `MessageResponse` |
| ← server | `message:deleted-everyone` | `{ messageId }` |
| ← server | `message:pinned` / `message:unpinned` | `{ messageId }` |
| ← server | `message:seen` | `{ conversationId, seenBy }` |
| ← server | `message:delivered` | `{ messageId, deliveredTo }` |
| ← server | `message:delivered-bulk` | `{ messageIds: number[], deliveredTo }` — sent to the sender when the recipient reconnects and everything queued gets delivered at once |
| ← server | `typing:update` | `{ conversationId, userId, isTyping }` |
| ← server | `group:member-added` | `{ conversationId, userIds }` |
| ← server | `group:member-removed` | `{ conversationId, userId }` |
| ← server | `group:member-left` | `{ conversationId, userId }` |
| ← server | `group:member-joined` | `{ conversationId, userId }` |
| ← server | `group:admin-promoted` / `group:admin-demoted` | `{ conversationId, userId }` |
| ← server | `group:updated` | `{ conversationId, ...changedFields }` (also `ownerId` on ownership transfer) |
| ← server | `group:deleted` | `{ conversationId }` |
| ← server | `group:join-request` | `{ conversationId, userId }` — to admins only, someone asked to join |
| ← server | `group:join-request-rejected` | `{ conversationId }` — to the requester |

Every group mutation **also** arrives as a `message:new` with `type: "SYSTEM"` (§7.3) — so a
client can rely on that single event stream for the timeline and treat the `group:*` events
above as optional hints for updating a members list / group-info screen already on screen.

Sending/editing/deleting messages themselves stay on **REST**, not sockets — the socket only
carries the resulting push notification plus purely-ephemeral events (typing, delivery acks).

**Offline delivery — nothing is ever lost.** A message is written to the DB before any
socket/push fires, so if the recipient was offline it's still there: `GET
/conversations/:id/messages` returns it and `unreadCount` (§7.1) counts it, and the FCM
push wakes the app whenever the device next has any connectivity (app open or not). The
moment the recipient's chat socket **(re)connects**, the server marks every still-`SENT`
message addressed to them as `DELIVERED` in one pass and fires `message:delivered-bulk`
back to each sender — so the client doesn't need to `message:ack-delivered` the backlog
one message at a time. Same for notifications and missed calls: both are persisted
(`GET /notifications`), so coming back online never means "you missed it forever".

### 11.4 `/calls`

| Direction | Event | Payload |
|---|---|---|
| → server | `call:raise-hand` | `{ callId, raised: boolean }` |
| ← server | `call:incoming` | `CallResponse` |
| ← server | `call:accepted` | `{ callId, userId }` |
| ← server | `call:rejected` | `{ callId, userId }` |
| ← server | `call:participant-rejected` | `{ callId, userId }` |
| ← server | `call:ended` | `{ callId, userId, status }` |
| ← server | `call:participant-left` | `{ callId, userId }` |
| ← server | `call:hand-raised` | `{ callId, userId, raised }` |

Mute/camera/speaker/switch-camera/screen-share are **not** signaled here — the LiveKit Android
SDK handles all of that directly through the room connection.

---

## 12. Data models & enums

All IDs (`id`, `userId`, `conversationId`, `messageId`, `callId`, ...) are **integers** (Postgres
`SERIAL`), not UUIDs. Model them as `Int`/`Long` in Kotlin, not `String`.

```kotlin
enum class Gender { MALE, FEMALE, OTHER }
enum class PrivacyLevel { EVERYONE, FOLLOWERS, NOBODY }  // FOLLOWERS not yet enforced, see §5
enum class FollowStatus { PENDING, ACCEPTED }
enum class ReportReason { SPAM, HARASSMENT, FAKE_ACCOUNT, INAPPROPRIATE_CONTENT, OTHER }
enum class ConversationType { DIRECT, GROUP }
enum class MessageType { TEXT, IMAGE, VIDEO, VOICE, FILE, LOCATION, CONTACT, SYSTEM, POLL }
enum class MessageStatus { SENT, DELIVERED, SEEN }
enum class ParticipantRole { MEMBER, ADMIN, OWNER }              // also CommunityMember's role
enum class GroupPermission { EVERYONE, ADMINS_ONLY }              // also Community.postPermission
enum class CommunityVisibility { PUBLIC, PRIVATE }
enum class CallType { AUDIO, VIDEO }
enum class CallStatus { RINGING, ONGOING, ENDED, MISSED, REJECTED }
enum class CallParticipantStatus { INVITED, JOINED, LEFT, REJECTED, MISSED }
enum class PostMediaType { IMAGE, VIDEO }
enum class PostContentFormat { PLAIN, MARKDOWN }
enum class RelationshipStatus {
    SINGLE, IN_A_RELATIONSHIP, ENGAGED, MARRIED, COMPLICATED, PREFER_NOT_TO_SAY,
}
enum class NotificationType {
    NEW_FOLLOWER, FOLLOW_REQUEST, FOLLOW_REQUEST_ACCEPTED,
    POST_LIKE, POST_COMMENT, POST_SHARE, POST_MENTION,
    COMMENT_REPLY, COMMENT_LIKE, MISSED_CALL,
}
enum class CommentReaction { LIKE, DISLIKE }
```

Profile "About" models (§5.1) — every field nullable unless noted:

```kotlin
data class ProfileAbout(
    val headline: String?, val currentCity: String?, val hometown: String?,
    val relationship: RelationshipStatus?, val website: String?,
    val languages: List<String>,           // never null, may be empty
)
data class ProfileEducation(
    val id: Int, val institution: String,  // institution required
    val degree: String?, val fieldOfStudy: String?,
    val startYear: Int?, val endYear: Int?, val isCurrent: Boolean, val description: String?,
)
data class ProfileExperience(
    val id: Int, val title: String, val company: String,   // both required
    val location: String?, val startDate: String?, val endDate: String?,
    val isCurrent: Boolean, val description: String?,
)
data class ProfileFeatured(
    val id: Int, val title: String,        // title required
    val url: String?, val imageUrl: String?, val note: String?, val position: Int,
)
```

`PollResponse` (§7.5, §9.4) — embedded as `PostResponse.poll` / `MessageResponse.poll`,
`null` on anything that isn't a poll:

```kotlin
data class PollResponse(
    val id: Int,
    val question: String,
    val allowMultipleAnswers: Boolean,
    val closesAt: String?,              // ISO datetime string
    val isClosed: Boolean,
    val totalVotes: Int,
    val options: List<PollOptionResult>,
    val myVoteOptionIds: List<Int>,      // same info as options[].votedByMe, flattened
)
data class PollOptionResult(
    val id: Int, val text: String, val voteCount: Int, val votedByMe: Boolean,
)
```

`CommunityDetails` / `CommunitySummary` / `CommunityMemberSummary` /
`CommunityJoinRequestSummary` (§9.5) are documented inline there rather than repeated here.

Full `User` object (returned by `/users/me`, `PATCH /users/me`, etc. — note this is the
*unfiltered* shape; `passwordHash` is always stripped server-side):

```kotlin
data class User(
    val id: Int,
    val email: String,
    val username: String,
    val phoneNumber: String?,
    val name: String,
    val avatarUrl: String?,
    val coverUrl: String?,
    val bio: String?,
    val gender: Gender?,
    val dateOfBirth: String?,           // ISO date string
    val isEmailVerified: Boolean,
    val isActive: Boolean,
    val isOnline: Boolean,
    val lastSeenAt: String?,            // ISO datetime string
    val isAdmin: Boolean,               // unrelated to the admin panel (§15) — only gates the
    val isSuperAdmin: Boolean,          // GET /users block-filter bypass (§5). Own account only.
    val deletedAt: String?,             // ISO datetime — set if you've soft-deleted (§5.2)
    val profilePhotoPrivacy: PrivacyLevel,
    val lastSeenPrivacy: PrivacyLevel,
    val onlineStatusPrivacy: PrivacyLevel,
    val isPrivate: Boolean,
    val createdAt: String,
    val updatedAt: String,
)

data class PublicUserSummary(
    val id: Int,
    val username: String,
    val name: String,
    val avatarUrl: String?,
)
```

---

## 13. Error handling cheat sheet

| Status | Meaning |
|---|---|
| 400 | Validation failure (check `errors[]`) — or an OTP resend still in its 60s cooldown (see §3.5) |
| 401 | Missing/expired/invalid token, wrong login credentials, a logged-out token (§3.5), a login lockout (§3.5), or the session ended by a login on another device (§3.6) — send to login unless silent-refresh recovers it (see §3.3) |
| 403 | Authenticated, but not allowed to do this (e.g. not a group admin, blocked user) |
| 404 | Resource not found — also used to hide existence (e.g. blocked users' profiles look "not found") |
| 409 | Conflict — e.g. username/email/phone number already taken |
| 429 | Rate limited (§3.5) — back off, don't retry in a tight loop |
| 500 | Server error — retry/backoff, don't treat as a client bug |

---

## 14. Quick end-to-end curl smoke test

```bash
BASE=http://40.81.26.50/api   # or http://localhost:3000/api against a locally-run server

curl -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","name":"Jane","password":"Str0ng!Pass"}'

# OTP is printed in the server console log if SMTP isn't configured
curl -X POST $BASE/auth/verify-email -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","code":"123456"}'

curl $BASE/users/me -H "Authorization: Bearer <accessToken>"
```

---

## 15. Admin API (for the separate Next.js admin panel)

**The admin panel is a wholly separate identity from ConnectX users — not a flag on `User`.**
There is a dedicated `Admin` table (own `username`/`email`/`passwordHash`/`role`), its own
login/token/forgot-password surface under `/admin/auth/*`, and its own JWT signed with a
**different secret** than the Android app's tokens. An admin's `username` can be identical to
some ConnectX user's `username` — they are unrelated rows in unrelated tables with unrelated
passwords, by design. A ConnectX user access token (from `/auth/login`) does **not** work on
any `/admin/*` route, and an admin access token does not work on any ConnectX-user route.

Everything below still hits the **same server/base URL** as the Android app and uses the same
response envelope (**§2**) — it's the same process, just a second, independent auth realm on
top of it.

> Historical note: an earlier version of this API gated `/admin/*` on `User.isAdmin`/
> `isSuperAdmin` flags (a ConnectX user *was* the admin). That's gone — those two `User`
> columns still exist, but now only gate the unrelated `GET /users` block-filter bypass
> (**§5**), nothing admin-panel-related.

### 15.1 Roles — `Admin.role: "SUPER_ADMIN" | "ADMIN"`

Every `Admin` row has exactly one role (not two booleans this time) — there's no "ordinary
admin row with no privileges" state the way `User` has; a row only exists once someone
deliberately creates one (§15.2).

| `role` | Unlocks today |
|---|---|
| `"ADMIN"` | User management (§15.5) — day-to-day moderation (list/search, delete, deactivate, force-logout, reset password/username, login history, reports-against-user). Does **not** unlock report moderation (§15.6) or admin-account management (§15.4) — both still require `SUPER_ADMIN`. |
| `"SUPER_ADMIN"` | **The entire `/admin/*` API** — everything `ADMIN` gets, plus report moderation (§15.6) and managing other admin accounts (§15.4). |

The admin's row is read fresh from Postgres **on every request** (not baked into the JWT), so
a role change (re-creating the account with a different role — there's no in-place role edit,
see §15.4) takes effect on that admin's very next API call.

### 15.2 Becoming an admin / super-admin

There is **deliberately no self-registration** — that would be a privilege-escalation hole.
Two different paths:

**A. The very first super-admin ever (bootstrap)** — chicken-and-egg: creating an admin
account requires already being a super-admin, so the first one has to be inserted directly
into Postgres, password pre-hashed with bcrypt:

```sql
-- password hash: bcrypt.hash('<the real password>', 12) — see hashWithBcrypt in the codebase,
-- or `node -e "require('bcrypt').hash('yourpassword',12).then(console.log)"`
INSERT INTO admins (username, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES ('<username>', '<email>', '<bcrypt hash>', 'SUPER_ADMIN', now(), now());
```

Run this once, against whichever Postgres the environment points at (local dev DB, or the
VM's `localhost:5432/connectx_db` over SSH). After this, `POST /admin/auth/login` with that
username/password returns a token that can call every `/admin/*` route.

Equivalently, `node prisma/seed-super-admins.js` (plain CommonJS, no `ts-node`/build needed —
safe on the 1 GiB production VM) upserts a fixed set of founder `SUPER_ADMIN` rows by email,
resetting the password if the email already exists. Edit the `SUPER_ADMINS` array in that file
first; re-running it is always safe (idempotent).

**B. Every subsequent admin/super-admin** — once at least one super-admin exists, they create
further accounts through the API itself (§15.4):

```
POST /admin/admins
{ "username": "mod1", "email": "mod1@example.com", "password": "...", "role": "ADMIN" }
```

There's no "edit an admin's role" endpoint — delete (§15.4) and re-create with the new role if
that's ever needed.

### 15.3 Endpoints — Admin auth (`/admin/auth`, public — no token required)

Mirrors the shape of `/auth/*` (**§3**) closely enough that the client code can mostly be
copy-adapted, but is a fully separate implementation underneath (separate token
service/session table/JWT secret) — see the historical note above.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/admin/auth/login` | `{ username, password }` | `{ admin, tokens }` |
| POST | `/admin/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/admin/auth/logout` | `{ refreshToken }` | `null` |
| POST | `/admin/auth/forgot-password` | `{ email }` | `null` (always 200, doesn't leak whether the email exists — same anti-enumeration shape as **§3.4**) |
| POST | `/admin/auth/reset-password` | `{ email, code, newPassword }` | `null` (also revokes every existing admin session, forcing re-login everywhere) |

Notes that differ from the ConnectX `/auth/*` flow:
- **`login` takes `username` only** — not an `identifier` that also accepts email, unlike
  ConnectX `/auth/login` (**§3.4**). Deliberately unambiguous about which identity is logging in.
- **No refresh-token silent-retry header trick** (**§3.3**'s `x-refresh-token` auto-rotation) —
  the admin panel should call `POST /admin/auth/refresh` explicitly when its access token
  expires (8h, same lifetime as the main app). Refresh tokens themselves are effectively
  non-expiring, same policy as ConnectX (a session ends on logout / password reset / another
  device logging in — not on a timer).
- **Password rule**: same as ConnectX — 4–72 chars, no complexity requirement (**§3.4**).
- **OTP**: same 4-digit / 10-minute / 5-attempt policy as ConnectX (shared config), delivered
  by email the same way (**§3.4**'s "expires shortly" template, subject "reset your password").
- Login lockout (5 failed attempts) uses the same mechanism as ConnectX login (**§3.5**) with
  a distinct counter — a same-named ConnectX user's failed logins can't lock out an admin
  account or vice versa.

### 15.4 Endpoints — Admin accounts (`/admin/admins`, super-admin only)

This is how admin/super-admin accounts get created and removed — see §15.2.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/admin/admins` | `{ username, email, password, role: "ADMIN" \| "SUPER_ADMIN" }` | `AdminAccountSummary` |
| GET | `/admin/admins` | `?cursor&limit` | Paginated `AdminAccountSummary[]` |
| DELETE | `/admin/admins/:id` | — | `null` |

`DELETE` refuses two things, both `400`:
- **deleting your own account** (`"You cannot delete your own admin account"`) — log in as a
  different super-admin first if that's really the goal;
- **deleting the last remaining `SUPER_ADMIN`** (`"Cannot delete the last remaining super
  admin"`) — the panel must always have at least one way back in.

### 15.5 Endpoints — Users (`/admin/users`, ADMIN or SUPER_ADMIN)

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/admin/users` | `?cursor&limit&search&status` | Paginated `AdminUserSummary[]` |
| GET | `/admin/users/:id` | — | `AdminUserDetail` |
| DELETE | `/admin/users/:id` | — | `null` — **permanent** removal (see below) |
| PATCH | `/admin/users/:id/deactivate` | `{ days: number }` (1–365, required) | `null` — **timed** suspension (see below) |
| PATCH | `/admin/users/:id/reactivate` | — | `null` — reverses a delete or ends a suspension early |
| PATCH | `/admin/users/:id/password` | `{ password }` (4–72 chars) | `null` — sets a new password directly, no old-password check |
| PATCH | `/admin/users/:id/username` | `{ username }` (3–30 chars, `[a-zA-Z0-9_.]+`) | `AdminUserDetail` |
| POST | `/admin/users/:id/force-logout` | — | `null` — kills every session on every device |
| GET | `/admin/users/:id/login-history` | `?cursor&limit` | Paginated `LoginEventSummary[]` — same shape as the self-service `GET /auth/login-history` (**§3**), for any user |
| GET | `/admin/users/:id/reports` | `?cursor&limit&status` | Paginated `AdminReportSummary[]` — reports filed *against* this user |

`search` matches username, name, email, and phone number, case-insensitively. `status` is
`active \| inactive \| all` (default `all`). Results are newest-account-first
(`id desc`), unlike the Android `GET /users` directory which is oldest-first. No `role` field
on these rows anymore — a ConnectX `User` isn't an admin-panel concept at all now (§15.1).

**`DELETE` (permanent) is intentionally indistinguishable from a self-delete** — same
`isActive: false` + `deletedAt` flip, same session/refresh-token/device-token teardown as
**§5.2**. There's no separate "banned" flag in the data; a deleted account looks, from the
outside, exactly like the user deleted themselves. Only an explicit `reactivate` undoes it.

**`PATCH .../deactivate` (timed) is a separate, self-expiring lockout** — same session
teardown, but stamps `deactivatedUntil` (now + `days`) instead of `deletedAt`. There's no
cron job: the check happens lazily, the next time that user attempts `POST /auth/login` — if
`deactivatedUntil` has passed, the account is silently reactivated (`isActive: true`,
`deactivatedUntil: null`) and the login proceeds normally. Until then, login fails with
`401 "This account is deactivated until <ISO datetime>"`. `reactivate` can also end it early.
A user can only be in one state at a time — starting either action clears the other
(`deletedAt`/`deactivatedUntil` never both set).

**`PATCH .../password` and `.../username`** reuse the exact same validation and side effects
as the self-service equivalents: password change revokes every existing session (**§3.4**'s
reset-password behavior) so the user must log in again with the new password; username change
runs the same uniqueness check and profile-cache invalidation as `PATCH /users/me` (**§5**),
returning `409 "Username is already taken"` on conflict.

### 15.6 Endpoints — Reports / moderation (`/admin/reports`, super-admin only)

Reports are filed by ordinary users via `POST /block/:username/report` (**§6**) and start
life as `PENDING`. This is the moderation queue for them:

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/admin/reports` | `?cursor&limit&status` | Paginated `AdminReportSummary[]` — every report, newest first |
| PATCH | `/admin/reports/:id/resolve` | `{ status: "REVIEWED" \| "DISMISSED" }` | `null` |

`status` filter accepts `PENDING \| REVIEWED \| DISMISSED`. Resolving stamps `reviewedAt` (now)
and `reviewedById` (the resolving **admin's** id — a row in `Admin`, not `User`, now that the
two identities are separate) — a report can be re-resolved (e.g. `REVIEWED` then later
`DISMISSED`), each call just overwrites the previous stamp.

### 15.7 Shapes (TypeScript, for the Next.js client)

```ts
type AdminRole = "SUPER_ADMIN" | "ADMIN";

// POST /admin/auth/login → data.admin, and every row of GET /admin/admins.
interface AdminAccountSummary {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

interface AdminUserSummary {
  id: number;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  deletedAt: string | null;         // ISO datetime, set only by a permanent DELETE
  deactivatedUntil: string | null;  // ISO datetime, set only by a timed PATCH .../deactivate
  createdAt: string;
}

// GET /admin/users/:id — the full User row (minus passwordHash/activeSessionId) plus:
interface AdminUserDetail extends AdminUserSummary {
  phoneNumber: string | null;
  bio: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  isEmailVerified: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  isAdmin: boolean;           // the OTHER isAdmin (§5/§12) — unrelated to the admin panel
  isSuperAdmin: boolean;      // ditto — don't confuse with Admin.role above
  isPrivate: boolean;
  updatedAt: string;
  reportCount: number;        // total reports ever filed against this user
}

interface AdminReportSummary {
  id: number;
  reason: "SPAM" | "HARASSMENT" | "FAKE_ACCOUNT" | "INAPPROPRIATE_CONTENT" | "OTHER";
  details: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  createdAt: string;
  reviewedAt: string | null;
  reviewedById: number | null;   // an Admin.id, not a User.id
  reporter: { id: number; username: string; name: string; avatarUrl: string | null };
  reported: { id: number; username: string; name: string; avatarUrl: string | null };
}
```

### 15.8 Errors specific to `/admin/*`

| Status | Meaning |
|---|---|
| `401 "Invalid credentials"` | `POST /admin/auth/login` — bad username/password. |
| `401 "Logged in on another device"` | Another login (or password reset) opened a newer admin session — same single-active-session rule as ConnectX (**§3.6**). |
| `403 "Super admin access required"` | Valid admin token — just not a super-admin. Only `/admin/reports` and `/admin/admins` routes require this now; `/admin/users` (§15.5) accepts `ADMIN` too. Show an access-denied screen; don't retry. |
| `400 "You cannot delete your own admin account"` / `400 "Cannot delete the last remaining super admin"` | `DELETE /admin/admins/:id` guardrails — see §15.4. |
| `409 "Username is already taken"` / `409 "Email is already registered"` | `POST /admin/admins` — pick a different value. |
| `409 "Username is already taken"` | `PATCH /admin/users/:id/username` — pick a different value. |
| `401 "This account is deactivated until <ISO datetime>"` / `401 "This account has been deactivated"` | `POST /auth/login` for a user under a still-active timed suspension / permanent delete respectively — not an `/admin/*` error itself, but the visible effect of §15.5's `deactivate`/`DELETE`. |
| `404 "User not found"` / `404 "Report not found"` / `404 "Admin not found"` | Bad `:id` in the path. |

Everything else (validation `400`s on `search`/`status`/`role` values, etc.) follows the same
envelope as **§2**/**§13**. A **ConnectX user access token on any `/admin/*` route** — or an
admin token on any ConnectX-user route — is a plain `401 Unauthorized` with no further detail
(different JWT secret, so it never even reaches the point of checking who the token belongs
to; see the historical note at the top of §15).
