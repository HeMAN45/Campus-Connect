# 02. Technical Requirements Document (TRD)

**Product:** Campus Connect
**Version:** 1.0 (MVP)
**Related:** [01-PRD.md](01-PRD.md), [05-BACKEND-SCHEMA.md](05-BACKEND-SCHEMA.md), [architecture.md](architecture.md)
**Last updated:** 2026-10-11

---

## 1. Purpose and Scope

This document defines how Campus Connect is built: the stack, project layout, configuration, authentication, every API endpoint, the real-time protocol, upload handling, ranking, security controls, performance limits, and testing. It is the contract between frontend and backend. If code and this document disagree, fix one of them in the same commit.

---

## 2. Technology Stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Runtime | Node.js | 22.13+ (built and tested on 24) | One language across client and server; ships a built-in SQLite driver |
| HTTP server | Express | 4.21 | Mature, minimal, huge middleware ecosystem |
| Database | SQLite via Node's built-in `node:sqlite` | SQLite 3.45+ | Zero setup, single file, no native compile on Windows, synchronous API, FTS5 search built in; perfect for a hackathon and a pilot |
| Real-time | Socket.IO | 4.7 | Rooms, reconnection, fallback transports, simple auth handshake |
| Auth | `bcryptjs` + `jsonwebtoken` | 2.4 / 9.0 | Pure JS hashing (no native build on Windows), standard JWT |
| Validation | `zod` | 3.23 | One schema per request body, readable error messages |
| Uploads | `multer` | 1.4.5-lts | Multipart parsing with size and type limits |
| Email | `nodemailer` | 6.9 | SMTP for OTP; console fallback in development |
| Security middleware | `helmet`, `cookie-parser`, in-house rate limiter (`middleware/rateLimit.js`) | latest | Security headers, cookie auth, brute-force protection without extra dependencies |
| PWA | `vite-plugin-pwa` (Workbox) | 0.20 | Web app manifest, service worker, offline shell, cached images, installable on Android, iOS, and desktop |
| Frontend framework | React | 18.3 | Component model, team familiarity |
| Build tool | Vite | 5.4 | Instant dev server, proxy to API |
| Routing | React Router | 6.26 | Nested layouts, loaders not required |
| Styling | Tailwind CSS | 3.4 | Fast, consistent design tokens (see UI/UX brief) |
| Icons | lucide-react | 0.441 | Clean line icons, tree-shakable |
| Real-time client | socket.io-client | 4.7 | Matches server |
| Fonts | Inter via `@fontsource/inter` | latest | Self-hosted, no third-party font CDN |

### 2.1 Why not X?

| Alternative | Reason not chosen for MVP |
|---|---|
| Firebase / Supabase | Faster auth, but domain restriction plus custom roles plus data ownership by the college are easier with our own server; also avoids vendor lock-in for a college pilot |
| PostgreSQL | Better at scale but needs a running service; SQLite is enough for one campus. Migration path in section 19 |
| Next.js | SSR is not needed behind a login wall; Vite + Express keeps the API explicit and easy to demo |
| Cloudinary / S3 | Adds accounts and keys; local disk is fine for MVP, behind an interface that can be swapped |

---

## 3. System Overview

```
Browser (React SPA)
   |  HTTPS: /api/*  (JSON, multipart)
   |  WSS:   /socket.io  (DM, typing, notifications)
   v
Express app (Node.js) ---- node:sqlite ----> data/campus.db (SQLite, WAL)
   |
   +---- Multer ----> uploads/ (images, served at /uploads/*)
   +---- Nodemailer ----> SMTP (OTP emails) or console in dev
```

Full diagrams and request lifecycles are in [architecture.md](architecture.md).

---

## 4. Repository Structure

```
C:\DH
|-- docs\                      Specification documents (this folder)
|-- server\
|   |-- index.js               App bootstrap: Express, Socket.IO, static, error handler
|   |-- config.js              Reads and validates environment variables
|   |-- db\
|   |   |-- index.js           Opens SQLite, sets pragmas, runs migrations
|   |   |-- migrations\        001_init.sql, 002_fts.sql, ...
|   |-- middleware\
|   |   |-- auth.js            requireAuth, optionalAuth, requireRole, requireActive
|   |   |-- upload.js          Multer instances: postImages, singleImage, avatar
|   |   |-- validate.js        zod body/query validation wrapper
|   |   |-- rateLimits.js      Named rate limiters
|   |   |-- errors.js          HttpError class, notFound, errorHandler
|   |-- routes\
|   |   |-- auth.js            OTP, register, login, logout, me
|   |   |-- users.js           Directory, profiles, settings, avatar, block
|   |   |-- posts.js           Feed, CRUD, votes, resolve, pin, RSVP, accept answer
|   |   |-- comments.js        CRUD, votes
|   |   |-- communities.js     List, create, join/leave, members, roles
|   |   |-- conversations.js   DM threads and messages
|   |   |-- notifications.js   List, mark read
|   |   |-- reports.js         Create report
|   |   |-- admin.js           Pending teachers, reports queue, suspensions, community requests
|   |   |-- search.js          Global search
|   |-- services\
|   |   |-- mailer.js          sendOtp(email, code)
|   |   |-- otp.js             create, verify, rate checks
|   |   |-- notify.js          createNotification + socket emit
|   |   |-- ranking.js         hot score
|   |   |-- permissions.js     canPostAnnouncement, canModerate, ...
|   |-- socket.js              Socket.IO auth, rooms, DM and typing events
|   |-- seed\                  Seed JSON + seed.js (see 07-DATASET-GUIDE.md)
|   |-- data\                  campus.db (git-ignored)
|   |-- uploads\               Uploaded images (git-ignored)
|   |-- .env.example
|   |-- package.json
|-- client\
|   |-- index.html
|   |-- vite.config.js         Proxy /api, /uploads, /socket.io -> :4000
|   |-- tailwind.config.js     Design tokens from 04-UIUX-BRIEF.md
|   |-- src\
|   |   |-- main.jsx, App.jsx  Router and providers
|   |   |-- lib\api.js         fetch wrapper, error mapping
|   |   |-- lib\socket.js      Socket singleton
|   |   |-- lib\format.js      Relative time, counts
|   |   |-- context\AuthContext.jsx
|   |   |-- context\SocketContext.jsx
|   |   |-- components\        AppShell, PostCard, Composer, CommentThread, ImagePicker, Lightbox, ...
|   |   |-- pages\             Login, Register, Home, PostDetail, Communities, Community, Directory,
|   |                          Profile, Settings, Messages, Notifications, Admin, NotFound
|-- .gitignore
|-- README.md
```

---

## 5. Configuration

All server configuration comes from environment variables, loaded from `server/.env` in development. `config.js` validates them at startup and exits with a clear message if a required one is missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4000` | API and socket port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `JWT_SECRET` | Yes | none | At least 32 random characters |
| `JWT_EXPIRES_IN` | No | `7d` | Session length |
| `ALLOWED_EMAIL_DOMAIN` | No | `dypiu.ac.in` | Registration domain; subdomains allowed |
| `DB_PATH` | No | `./data/campus.db` | SQLite file |
| `UPLOAD_DIR` | No | `./uploads` | Image storage |
| `MAX_UPLOAD_MB` | No | `5` | Per-image size limit |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | CORS and socket origin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Production only | none | If `SMTP_HOST` is empty, OTPs are printed to the server console, and outside production `POST /auth/otp/request` returns `{ devCode }` so the UI can show it |
| `ADMIN_EMAILS` | No | none | Comma-separated emails promoted to admin on registration or seed |

---

## 6. Authentication and Authorization

### 6.1 Email domain rule

```js
const domain = config.ALLOWED_EMAIL_DOMAIN.replace(/\./g, '\\.');
const EMAIL_RE = new RegExp(`^[a-z0-9._%+-]+@([a-z0-9-]+\\.)*${domain}$`, 'i');
```

Accepts `20240802741@dypiu.ac.in` and `name@xxx.dypiu.ac.in`. Rejects `name@dypiu.ac.in.evil.com` and `name@notdypiu.ac.in`. Emails are trimmed and lowercased before storage.

### 6.2 OTP

| Rule | Value |
|---|---|
| Format | 6 digits from `crypto.randomInt(0, 1_000_000)`, zero padded |
| Storage | SHA-256 of `code + email + JWT_SECRET` in `email_otps.code_hash` |
| Expiry | 10 minutes |
| Max verify attempts | 5 per OTP |
| Resend cooldown | 60 seconds |
| Max OTPs | 5 per email per hour, 20 per IP per hour |
| Purposes | `register`, `reset_password` |

Verification uses `crypto.timingSafeEqual` on the hashes. A successful verify marks the OTP consumed and returns a short-lived **registration token** (JWT, 15 minutes, claim `{ email, purpose: 'register' }`) that the register call must include. This splits "prove the email" from "create the account" so the UI can be two steps.

### 6.3 Passwords

- `bcryptjs` with cost 10.
- Rule: 8 to 72 characters, at least one letter and one digit.
- Login failures return the same message for unknown email and wrong password: "Email or password is incorrect."

### 6.4 Session

- On login or register, the server issues a JWT `{ sub: userId, role, status }`, signed HS256 with `JWT_SECRET`, expiry `JWT_EXPIRES_IN`.
- Sent as cookie `cc_session`: `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`, `maxAge` matching expiry.
- The SPA never reads the token. It calls `GET /api/auth/me` on load to get the current user.
- Logout clears the cookie.
- Because role and status can change (teacher approval, suspension), `requireAuth` re-reads the user row on every request (a primary key lookup, under 0.1 ms in SQLite) and rejects suspended users. The JWT is therefore only an identity proof, not a permission cache.

### 6.5 Middleware

| Middleware | Behavior |
|---|---|
| `requireAuth` | Reads cookie, verifies JWT, loads user, sets `req.user`; 401 if missing/invalid; 403 `SUSPENDED` if suspended |
| `requireRole(...roles)` | 403 `FORBIDDEN` unless `req.user.role` is in roles |
| `requireVerifiedTeacherOrAdmin` | Teacher with status `active`, or admin |
| `requireCommunityRole(minRole)` | Loads membership for `:slug` and checks `member < moderator < admin`; platform admins pass |

Permission logic lives in `services/permissions.js` so routes and UI rules match the PRD matrix (PRD section 7). The `/api/auth/me` response includes a `permissions` object (`canPostCampusAnnouncement`, `canCreateCommunity`, `isAdmin`) so the UI can hide buttons, but the server always re-checks.

---

## 7. API Conventions

| Topic | Convention |
|---|---|
| Base path | `/api` |
| Format | JSON request and response, except uploads (`multipart/form-data`) |
| Naming | `snake_case` in database, `camelCase` in JSON |
| Timestamps | ISO 8601 UTC strings, for example `2026-10-11T09:30:00.000Z` |
| IDs | Integers |
| Pagination | Cursor based: `?cursor=<opaque>&limit=20`; response `{ items: [...], nextCursor: "..." | null }` |
| Success codes | 200 read/update, 201 create, 204 delete/no content |
| Errors | `{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "fields": { "title": "Too short" } } }` |

### 7.1 Error codes

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body or query fails zod schema |
| 400 | `INVALID_EMAIL_DOMAIN` | Email not in allowed domain |
| 400 | `OTP_INVALID` / `OTP_EXPIRED` / `OTP_LOCKED` | OTP problems |
| 401 | `UNAUTHENTICATED` | No or bad session |
| 403 | `FORBIDDEN` | Role or ownership check failed |
| 403 | `SUSPENDED` | User suspended, includes `until` |
| 403 | `PENDING_APPROVAL` | Pending teacher tried an announcement |
| 403 | `BLOCKED` | DM to a user who blocked you |
| 404 | `NOT_FOUND` | Resource missing or soft-deleted |
| 409 | `EMAIL_TAKEN` / `ALREADY_MEMBER` / `SLUG_TAKEN` | Conflicts |
| 413 | `FILE_TOO_LARGE` | Image over limit |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not an allowed image |
| 429 | `RATE_LIMITED` | Too many requests, includes `retryAfter` seconds |
| 500 | `INTERNAL` | Unexpected; message is generic, details only in server logs |

---

## 8. API Reference

`Auth` column: `-` public, `U` any logged-in active user, `T` verified teacher, `A` platform admin, `CM` community moderator or admin, `O` owner of the resource.

### 8.1 Auth

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| POST | `/api/auth/otp/request` | - | `{ email, purpose: "register" }` | 204. Errors: `INVALID_EMAIL_DOMAIN`, `EMAIL_TAKEN`, `RATE_LIMITED` |
| POST | `/api/auth/otp/verify` | - | `{ email, code, purpose }` | `{ registrationToken }` |
| POST | `/api/auth/register` | - | `{ registrationToken, name, password, role: "student"|"teacher", departmentId, program?, year?, section?, designation?, officeLocation?, officeHours? }` | 201 `{ user }` + session cookie |
| POST | `/api/auth/login` | - | `{ email, password }` | `{ user }` + session cookie |
| POST | `/api/auth/logout` | U | none | 204, cookie cleared |
| GET | `/api/auth/me` | U | none | `{ user, permissions, unread: { messages, notifications } }` |
| GET | `/api/auth/unread` | U | none | `{ messages, notifications }` (cheap badge refresh) |
| POST | `/api/auth/otp/request` | - | `{ email, purpose: "reset_password" }` | 204 always, so account existence is not revealed |
| POST | `/api/auth/otp/verify` | - | `{ email, code, purpose: "reset_password" }` | `{ resetToken }` (15 min) |
| POST | `/api/auth/password/reset` | - | `{ resetToken, newPassword }` | 204 |
| POST | `/api/auth/password/change` | U | `{ currentPassword, newPassword }` | 204 |
| GET | `/api/meta` | - | none | Departments, programs, designations, subject tags, mentor topics, allowed domain, upload limit |

### 8.2 Users and directory

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/users` | U | `q, role, departmentId, year, mentor=1, teachesYear, cursor, limit<=24` | `{ items: [UserCard], nextCursor }` |
| GET | `/api/users/seniors` | U | `topic?, cursor` | Students with `openToMentor=1` and `year > viewer.year`, same department first |
| GET | `/api/users/:id` | U | none | `{ user: UserProfile, isBlocked, hasBlockedYou }` |
| GET | `/api/users/:id/posts` | U | `cursor` | Paged posts |
| GET | `/api/users/:id/communities` | U | none | Communities list |
| PATCH | `/api/users/me` | U | Editable profile fields (see schema doc) | `{ user }` |
| POST | `/api/users/me/avatar` | U | multipart `avatar` | `{ avatarUrl }` |
| POST | `/api/users/:id/block` | U | none | 204 |
| DELETE | `/api/users/:id/block` | U | none | 204 |

`UserCard`: `{ id, name, avatarUrl, role, status, department: { id, code, name }, year, designation, officeLocation, openToMentor }`.

### 8.3 Posts

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/posts` | U | `tab=all|announcements|events|doubts|requests|lostfound`, `sort=hot|new|top`, `communityId?`, `subject?`, `unanswered=1?`, `status=open|resolved?`, `cursor` | `{ pinned: [Post], items: [Post], nextCursor }` (pinned only on first page) |
| GET | `/api/posts/upcoming-events` | U | `limit<=10` | `[Post]` where type=event and start in future |
| POST | `/api/posts` | U (type rules apply) | multipart: `type, title, body, communityId?, subjectTag?, neededBy?, itemLocation?, itemDate?, eventStartsAt?, eventEndsAt?, eventVenue?, eventUrl?, commentsLocked?, images[] (0..4), imageAlts[]` | 201 `{ post }` |
| GET | `/api/posts/:id` | U | none | `{ post, acceptedComment? }` |
| PATCH | `/api/posts/:id` | O (24 h) or A | `{ title?, body? }` | `{ post }` |
| DELETE | `/api/posts/:id` | O, CM, A | none | 204 (soft delete) |
| POST | `/api/posts/:id/vote` | U, not O | `{ value: 1 | -1 | 0 }` | `{ score, myVote }` |
| POST | `/api/posts/:id/resolve` | O, A | `{ resolved: true|false }` | `{ status }` (doubt, request, lost, found only) |
| POST | `/api/posts/:id/accept` | O | `{ commentId | null }` | `{ acceptedCommentId }` (doubt only) |
| POST | `/api/posts/:id/pin` | per PRD matrix | `{ pinned: true|false }` | `{ isPinned, pinnedUntil }` |
| POST | `/api/posts/:id/lock-comments` | O, CM, A | `{ locked: true|false }` | `{ commentsLocked }` |
| PUT | `/api/posts/:id/rsvp` | U | `{ status: "going"|"interested"|null }` | `{ myRsvp, goingCount, interestedCount }` |
| GET | `/api/posts/:id/rsvps` | O, CM, A | `format=json|csv` | List or CSV download |

`Post` shape:

```json
{
  "id": 42,
  "type": "event",
  "title": "GDGC Build with AI Workshop",
  "body": "Hands-on session...",
  "author": { "id": 7, "name": "Sneha Patil", "avatarUrl": "/uploads/a1.webp", "role": "student", "badges": ["community_admin"] },
  "community": { "id": 3, "slug": "gdgc", "name": "GDGC DYPIU", "type": "club" },
  "images": [{ "url": "/uploads/p42-1.webp", "alt": "Event poster", "width": 1080, "height": 1350 }],
  "status": "open",
  "isPinned": false,
  "commentsLocked": false,
  "subjectTag": null,
  "acceptedCommentId": null,
  "event": { "startsAt": "2026-10-18T09:30:00.000Z", "endsAt": "2026-10-18T12:30:00.000Z", "venue": "Seminar Hall, Block A", "url": null, "goingCount": 86, "interestedCount": 40, "myRsvp": "going" },
  "item": null,
  "neededBy": null,
  "score": 31,
  "myVote": 1,
  "commentCount": 12,
  "createdAt": "2026-10-11T08:00:00.000Z",
  "editedAt": null
}
```

Type-specific validation (enforced by zod `discriminatedUnion` on `type`):

| Type | Required extra fields | Server permission check |
|---|---|---|
| `general` | none | active user; member if `communityId` |
| `doubt` | `subjectTag` (1 to 30 chars) | same |
| `request` | none (`neededBy` optional, must be in future) | same |
| `lost`, `found` | `itemLocation` (2 to 100), `itemDate` (not in future) | same |
| `announcement` | none | no community: verified teacher or admin; with community: CM, verified teacher member, or admin |
| `event` | `communityId`, `eventStartsAt` (future), `eventVenue`; `eventEndsAt` after start | CM of that community, verified teacher, or admin |

### 8.4 Comments

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/posts/:id/comments` | U | `sort=top|new` | `{ items: [Comment with replies[]] }` (all comments, max 500; threads are small) |
| POST | `/api/posts/:id/comments` | U (member if community post; not if locked or resolved lost/found) | multipart: `body?, parentId?, image?, imageAlt?` (body or image required) | 201 `{ comment }` |
| PATCH | `/api/comments/:id` | O | `{ body }` | `{ comment }` |
| DELETE | `/api/comments/:id` | O, CM, A | none | 204 |
| POST | `/api/comments/:id/vote` | U, not O | `{ value: 1 | -1 | 0 }` | `{ score, myVote }` |

`Comment`: `{ id, postId, parentId, author: UserMini, body, image: { url, alt } | null, score, myVote, isAccepted, isDeleted, createdAt, editedAt, replies: [Comment] }`.

### 8.5 Communities

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/communities` | U | `type?, q?, mine=1?` | `[CommunityCard]` |
| POST | `/api/communities` | U | multipart: `name, slug, type (club|interest), description, rules?, avatar?, cover?` | 201; status `active` if T or A, else `pending` |
| GET | `/api/communities/:slug` | U | none | `{ community, myRole: null|"member"|"moderator"|"admin", admins: [UserMini] }` |
| PATCH | `/api/communities/:slug` | CM admin, A | `{ description?, rules? }` + optional images | `{ community }` |
| POST | `/api/communities/:slug/join` | U | none | 204 (`ALREADY_MEMBER` 409) |
| POST | `/api/communities/:slug/leave` | U | none | 204 (last admin cannot leave) |
| GET | `/api/communities/:slug/members` | U | `role?, q?, cursor` | Paged members with roles |
| PATCH | `/api/communities/:slug/members/:userId` | CM admin, A | `{ role: "member"|"moderator"|"admin" }` | 204 |
| DELETE | `/api/communities/:slug/members/:userId` | CM admin, A | none | 204 (remove member) |
| GET | `/api/communities/:slug/events` | U | `when=upcoming|past` | `[Post]` |

### 8.6 Conversations (DMs)

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/conversations` | U | none | `[{ id, otherUser: UserMini, lastMessage: { body, hasImage, senderId, createdAt }, unreadCount }]` sorted by last message |
| POST | `/api/conversations` | U | `{ userId }` | `{ conversation }` (get or create; 403 `BLOCKED`) |
| GET | `/api/conversations/:id/messages` | participant | `before=<messageId>?, limit<=30` | `{ items: [Message], hasMore }` oldest to newest within page |
| POST | `/api/conversations/:id/messages` | participant | multipart: `body?, image?, clientId` | 201 `{ message }`, also emitted over socket |
| POST | `/api/conversations/:id/read` | participant | `{ lastReadMessageId }` | 204, emits `message:read` |

`Message`: `{ id, conversationId, senderId, body, image: { url } | null, createdAt, clientId }`. `clientId` is a UUID generated by the sender to match the optimistic message to the server copy.

Sending a message goes over HTTP (so multipart images work and errors are returned cleanly). The server then emits it to both participants over the socket.

### 8.7 Notifications, reports, search, admin

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/notifications` | U | `cursor` | `{ items: [Notification], nextCursor, unreadCount }` |
| POST | `/api/notifications/read` | U | `{ ids?: number[] }` (none = all) | 204 |
| POST | `/api/reports` | U | `{ targetType: "post"|"comment"|"message"|"user", targetId, reason, details? }` | 201 (one open report per user per target) |
| GET | `/api/search` | U | `q` (2 to 100 chars) | `{ posts: [Post], people: [UserCard], communities: [CommunityCard] }` max 5 each |
| GET | `/api/admin/teachers/pending` | A | none | `[UserCard]` |
| POST | `/api/admin/teachers/:id/decision` | A | `{ approve: boolean, reason? }` | 204 |
| GET | `/api/admin/reports` | A (CM sees own community via `communityId`) | `status=open|actioned|dismissed` | `[Report with target preview]` |
| POST | `/api/admin/reports/:id/resolve` | A, CM | `{ action: "dismiss"|"remove"|"suspend", suspendDays?: 7|30|null }` | 204 |
| GET | `/api/admin/communities/pending` | A | none | Pending community requests |
| POST | `/api/admin/communities/:id/decision` | A | `{ approve, reason? }` | 204 |
| GET | `/api/admin/stats` | A | none | Counts: users, posts today, open reports, active sockets |

### 8.8 Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | - | `{ ok: true, db: "ok", uptime }` |

---

## 9. Real-time Protocol (Socket.IO)

### 9.1 Connection

- Path `/socket.io`, same origin (Vite proxies in dev).
- Auth: the server reads the `cc_session` cookie from the handshake headers, verifies it, loads the user, and rejects suspended users with `connect_error` `UNAUTHENTICATED`.
- On connect the socket joins room `user:<id>`. A user with several tabs has several sockets in the same room, so every tab updates.
- Presence: the server keeps `Map<userId, socketCount>` in memory and updates `users.last_seen_at` on disconnect.

### 9.2 Events

| Direction | Event | Payload | Notes |
|---|---|---|---|
| server -> client | `message:new` | `Message` + `conversation: { id, otherUser }` | Sent to both participants' rooms |
| server -> client | `message:read` | `{ conversationId, readerId, lastReadMessageId }` | Shows "Seen" |
| client -> server | `typing` | `{ conversationId, isTyping }` | Server validates participation, relays as `typing` to the other user; client throttles to 1 per 2 s |
| server -> client | `typing` | `{ conversationId, userId, isTyping }` | UI hides after 4 s without update |
| server -> client | `notification:new` | `Notification` | Increments bell badge |
| server -> client | `presence` | `{ userId, online }` | Only to users who share a conversation (P1) |
| server -> client | `post:rsvp` | `{ postId, goingCount, interestedCount }` | Broadcast to room `post:<id>` while the post detail is open (P1) |
| client -> server | `post:watch` / `post:unwatch` | `{ postId }` | Join/leave `post:<id>` (P1) |

Every inbound event handler wraps its logic in try/catch and ignores payloads that fail validation. Inbound events are rate limited to 20 per second per socket.

---

## 10. File Uploads

| Rule | Value |
|---|---|
| Allowed types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Check | MIME from Multer and file signature (magic bytes) of the first 12 bytes; both must agree |
| Size | `MAX_UPLOAD_MB` (5 MB) per file |
| Count | Post: 4, comment: 1, message: 1, avatar: 1, community avatar and cover: 1 each |
| Storage name | `<kind>/<yyyy>/<mm>/<random 16 bytes hex>.<ext>`; original filename is never used on disk |
| Serving | `express.static(UPLOAD_DIR)` at `/uploads` with `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable` |
| Cleanup | If the database insert fails, the uploaded files are deleted in the error handler |
| Alt text | Optional `imageAlt` field per image (max 200 chars); UI prompts for it |
| DM image privacy | MVP serves all uploads by unguessable URL. P1: serve DM images through `/api/media/:id` with participant check |
| Upgrade path | `services/storage.js` exposes `save(buffer, kind)` and `remove(key)` so S3 or Cloudinary can replace the disk driver |

Image resizing (to max 1600 px and WebP) with `sharp` is P1. MVP stores originals.

---

## 11. Feed Ranking

**Hot** (default sort):

```
hot = (score + 2 * commentCount + typeBoost) / (ageHours + 2) ^ 1.5
```

| Type | `typeBoost` |
|---|---|
| announcement | 10 |
| event (upcoming) | 8 |
| request (open, not expired) | 5 |
| lost / found (open) | 5 |
| doubt (unanswered) | 3 |
| others | 0 |

For MVP scale the server selects the newest 500 candidate posts for the tab, computes `hot` in JavaScript, sorts, and pages through them with a cursor that encodes the offset and a snapshot timestamp. When volume grows, store `hot` in a column refreshed every 5 minutes.

**New**: `ORDER BY created_at DESC, id DESC`, cursor is `(created_at, id)`.
**Top**: score within the last 7 days, `ORDER BY score DESC, id DESC`.

Pinned posts are returned separately in `pinned` on the first page so they never shift paging.

---

## 12. Search

- Posts: SQLite FTS5 table `posts_fts(title, body, subject_tag)` kept in sync by triggers. Query uses prefix matching on each token (`dbms* normal*`), ranked by `bm25`.
- People: FTS5 table `users_fts(name, department, subjects, skills, office_location, designation)`.
- Communities: `LIKE` on name and description (small table).
- User input is tokenized server side and each token is quoted before building the FTS query, so special characters cannot break or inject into the query.

---

## 13. Notifications

`services/notify.js` exposes `notify(userIds, { type, actorId, postId?, commentId?, communityId?, data? })`:

1. Inserts rows in one transaction (fan-out on write; at 5,000 users a campus announcement is 5,000 small rows, about 50 ms in SQLite).
2. Emits `notification:new` to each `user:<id>` room that is online.
3. Never notifies the actor about their own action.
4. Collapses duplicates: a second comment on the same post within 10 minutes updates the existing unread notification ("Sneha and 3 others commented").

---

## 14. Security Requirements

| # | Control |
|---|---|
| S1 | All queries use prepared statements with bound parameters; no string-built SQL |
| S2 | React escapes output by default; `dangerouslySetInnerHTML` is forbidden. URLs in text are linkified by a component that only allows `http` and `https` and sets `rel="noopener noreferrer nofollow"` |
| S3 | `helmet()` with a CSP: `default-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'` |
| S4 | Session cookie is `httpOnly`, `sameSite=lax`, `secure` in production. State-changing routes accept only JSON or multipart and check `Origin` against `CLIENT_ORIGIN` (CSRF defense) |
| S5 | Rate limits: OTP request 5/hour/email and 20/hour/IP; OTP verify 10/15 min/IP; login 10/15 min/IP+email; post create 10/hour/user; comment 60/hour/user; message 120/min/user; report 20/day/user |
| S6 | Upload validation (section 10), random filenames, no execution from upload directory |
| S7 | Authorization checked on every route against ownership and the PRD matrix; IDs in URLs are never trusted without a check |
| S8 | DMs readable only by participants; admin access only through a report |
| S9 | Error responses never include stack traces or SQL in production |
| S10 | Secrets only in `.env`, which is git-ignored; `.env.example` holds placeholders |
| S11 | Body size limit `100kb` for JSON |
| S12 | Dependencies checked with `npm audit` before release |

---

## 15. Performance Targets and Limits

| Item | Target / Limit |
|---|---|
| Feed page (20 posts) | p95 under 150 ms server time |
| Directory search | p95 under 100 ms |
| DM send to receive | under 1 s |
| SQLite pragmas | `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000` |
| N+1 avoidance | Feed queries fetch posts, then images, votes, and RSVPs for all IDs in one `IN (...)` query each |
| Client bundle | under 300 KB gzipped for the initial route; routes lazy-loaded |
| Images in feed | `loading="lazy"`, fixed aspect boxes to avoid layout shift |

---

## 16. Logging and Error Handling

- Request log line: method, path, status, duration ms, user id. No bodies, no cookies, no OTPs.
- `errorHandler` maps `HttpError` to its code; `ZodError` to `VALIDATION_ERROR` with field messages; Multer errors to `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`; everything else to `INTERNAL` with the stack logged server side.
- Client `api.js` throws `ApiError { status, code, message, fields }`. Forms show `fields` inline; other errors show a toast. `401` anywhere redirects to `/login?next=<current>`.

---

## 17. Testing Strategy

| Level | Tool | Scope |
|---|---|---|
| API integration | `node:test` + `supertest` against an in-memory SQLite database | Auth domain rule, OTP limits, every permission row in the PRD matrix, post type validation, DM privacy, upload rejection |
| Socket | `socket.io-client` in tests | Message delivery to both participants, typing relay, unauthorized connection rejected |
| UI smoke | Manual checklist (06-IMPLEMENTATION-PLAN.md, section 8) in the browser | Every P0 flow from 03-APP-FLOW.md |
| Seed validation | `npm run seed` must run cleanly on an empty DB | Data integrity |

Minimum bar before the demo: all API integration tests pass and the manual checklist is green.

---

## 18. Browser and Device Support

Chrome, Edge, Firefox, Safari (last 2 versions); Android Chrome and iOS Safari 16+. Layout from 360 px to 1920 px. No Internet Explorer.

---

## 19. Known Limitations and Upgrade Path

| Limitation (MVP) | Upgrade |
|---|---|
| SQLite single writer | Move to PostgreSQL: schema uses portable types; replace the `get/all/run/tx` helpers in `db/index.js` with `pg`; FTS5 -> `tsvector` |
| Report queue is admin-only | Community moderators remove content directly from the post menu; a per-community report queue is P2 |
| Local disk uploads | `services/storage.js` S3 driver |
| Single Node process for sockets | Socket.IO Redis adapter for multiple instances |
| Fan-out notifications on write | Queue (BullMQ) when user count exceeds about 20,000 |
| No image moderation | Add a moderation API on upload in P2 |
| DM images served by unguessable URL | Authenticated media route (P1) |
