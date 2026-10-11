# 06. Implementation Plan

**Product:** Campus Connect
**Version:** 1.0 (MVP)
**Related:** all docs in this folder
**Last updated:** 2026-10-11

---

## 1. Strategy

1. **Vertical slices, not layers.** Each milestone ships a feature end to end (schema, API, UI) so there is always a demoable app.
2. **P0 first, demo path first.** Build the exact steps of the demo script (section 7) before anything else. If time runs out, cut from the bottom of the cut list (section 6), never from the demo path.
3. **One source of truth.** The PRD defines what, the TRD defines how, the schema defines data. Any change updates the doc in the same commit.
4. **Seed early.** Realistic seed data from milestone 2 onwards so the UI is always tested with real-looking content.

---

## 2. Milestones

Estimates are focused build hours for one experienced full-stack developer. With a team of four, see section 4 for the parallel split.

| # | Milestone | Hours | Output (Definition of Done) |
|---|---|---|---|
| M0 | Project setup | 2 | `server` and `client` run with one command each; Vite proxy works; Tailwind tokens in place; `/api/health` returns ok; `.env.example`; `.gitignore` |
| M1 | Database and auth | 5 | Migrations `001`, `002`; OTP request/verify with console mailer; register with domain rule; login/logout/me; auth context and guarded routes; 3-step register UI; login UI |
| M2 | App shell and feed | 6 | Sidebar, top bar, right rail, mobile tab bar; `GET /posts` with tabs and sorts; PostCard for all 7 types; skeletons; infinite scroll; seed script with demo data |
| M3 | Composer and post detail | 6 | `POST /posts` with type validation and up to 4 images; composer UI with type picker and type fields; post detail with image grid and lightbox; edit/delete; vote endpoints and UI |
| M4 | Comments with images and doubts | 4 | Comments API with image upload, replies, votes; comment thread UI; accept answer; resolve/fulfil for requests and lost/found |
| M5 | Communities, announcements, events | 6 | Communities list, page, join/leave, members and roles; create/request community; announcement permissions and pinning; event fields, RSVP, upcoming events rail, RSVP CSV |
| M6 | Directory, profiles, senior connect | 4 | Directory search and filters; seniors tab; profile page (student and faculty layouts); edit profile with avatar upload |
| M7 | Real-time DMs with images | 6 | Socket server with cookie auth; conversations API; message send with image; conversation UI with optimistic send, typing, seen; unread badges; "Message" and "Offer help" entry points; block |
| M8 | Notifications, reports, admin | 5 | Notify service with socket push; bell and notifications page; report modal; admin dashboard: pending faculty, reports, community requests |
| M9 | Search, polish, demo prep | 4 | Global search; empty/error states pass; mobile pass at 360 px; accessibility pass; final seed; demo rehearsal x3 |
| | **Total** | **48** | |

---

## 3. Detailed Task Breakdown

### M0. Project setup

| Task | Files |
|---|---|
| Server package, scripts (`dev` with `node --watch`, `seed`, `db:reset`, `test`) | `server/package.json` |
| Config loader with validation | `server/config.js`, `server/.env.example` |
| Express app, helmet, cors, cookie-parser, JSON limit, request logger, error handler, `/api/health` | `server/index.js`, `server/middleware/errors.js` |
| Vite React app, proxy for `/api`, `/uploads`, `/socket.io` to `:4000` | `client/vite.config.js`, `client/index.html`, `client/src/main.jsx` |
| Tailwind with tokens from UI/UX brief section 2; Inter font | `client/tailwind.config.js`, `client/postcss.config.js`, `client/src/index.css` |
| `.gitignore` for `node_modules`, `.env`, `server/data`, `server/uploads`, `client/dist` | `.gitignore` |

### M1. Database and auth

| Task | Files |
|---|---|
| DB open + pragmas + migration runner | `server/db/index.js` |
| Migrations from schema doc sections 3 and 4 | `server/db/migrations/001_init.sql`, `002_fts.sql` |
| OTP service (hash, expiry, attempts, cooldown) | `server/services/otp.js` |
| Mailer with console fallback | `server/services/mailer.js` |
| Rate limiters | `server/middleware/rateLimits.js` |
| zod validate middleware | `server/middleware/validate.js` |
| Auth routes and session cookie | `server/routes/auth.js` |
| `requireAuth`, `requireRole`, permission helpers | `server/middleware/auth.js`, `server/services/permissions.js` |
| API client wrapper with `ApiError` | `client/src/lib/api.js` |
| AuthContext (`me`, login, logout, refresh) | `client/src/context/AuthContext.jsx` |
| Login, Register (Email, Verify, Details), Forgot password pages | `client/src/pages/auth/*.jsx` |
| `RequireAuth`, `PublicOnly` guards and router | `client/src/App.jsx` |

### M2. App shell and feed

| Task | Files |
|---|---|
| Layout: `AppShell`, `Sidebar`, `TopBar`, `RightRail`, `MobileTabBar` | `client/src/components/layout/*` |
| Feed endpoint with tabs, sorts, cursors, batched images/votes/RSVPs | `server/routes/posts.js`, `server/services/ranking.js`, `server/services/postQueries.js` |
| Upcoming events endpoint | `server/routes/posts.js` |
| `PostCard`, `TypeLabel`, `AuthorLine`, `Badge`, `EventDateBlock`, `VoteButtons` | `client/src/components/post/*` |
| Home page with tab chips, sub filters, sort, infinite scroll, skeletons, empty state | `client/src/pages/Home.jsx` |
| Seed script v1 (departments, users, communities, posts) | `server/seed/*` |

### M3. Composer and post detail

| Task | Files |
|---|---|
| Upload middleware (type, size, magic bytes, random names), storage service | `server/middleware/upload.js`, `server/services/storage.js` |
| Create post with zod discriminated union and permission checks | `server/routes/posts.js` |
| Edit (24 h), delete (soft), vote | `server/routes/posts.js` |
| `Composer` with `TypePicker`, `WherePicker`, type field groups, `ImagePicker`, draft autosave | `client/src/components/composer/*` |
| Post detail page with `ImageGrid`, `Lightbox`, owner menu | `client/src/pages/PostDetail.jsx`, `client/src/components/media/*` |

### M4. Comments and doubts

| Task | Files |
|---|---|
| Comments routes with single image, replies (depth rule), votes, delete | `server/routes/comments.js` |
| Accept answer, resolve endpoints | `server/routes/posts.js` |
| `CommentComposer` (text + image + alt), `CommentThread`, `AcceptedAnswer` | `client/src/components/comments/*` |
| Doubt subject chips and "Unanswered" filter; request "Expired" logic | Home page, PostCard |

### M5. Communities, announcements, events

| Task | Files |
|---|---|
| Communities routes (list, get, create/request, join/leave, members, roles, events) | `server/routes/communities.js` |
| Auto-join on register (department, batch, official) | `server/routes/auth.js` |
| Pin, lock comments, announcement and event permission paths | `server/routes/posts.js`, `server/services/permissions.js` |
| RSVP endpoints and CSV export | `server/routes/posts.js` |
| Communities list page, Community page with tabs, Create community page, Community settings | `client/src/pages/communities/*` |
| `EventPanel`, `RsvpButtons`, `UpcomingEvents` rail widget | `client/src/components/events/*` |

### M6. Directory and profiles

| Task | Files |
|---|---|
| Users routes: directory search (FTS + filters), seniors, profile, update me, avatar, block | `server/routes/users.js` |
| `users_fts` reindex on register and update | `server/services/userIndex.js` |
| Directory page with filters and Seniors tab; `UserCard` | `client/src/pages/Directory.jsx`, `client/src/components/users/*` |
| Profile page (faculty "Find me" panel, student panel), Edit profile page | `client/src/pages/Profile.jsx`, `client/src/pages/settings/*` |

### M7. Real-time DMs

| Task | Files |
|---|---|
| Socket server: cookie auth, rooms, typing relay, rate limit | `server/socket.js` |
| Conversations routes: list, get-or-create, messages page, send with image, read | `server/routes/conversations.js` |
| Socket client singleton and `SocketContext` (badges, events) | `client/src/lib/socket.js`, `client/src/context/SocketContext.jsx` |
| Messages page: list pane, conversation pane, bubbles, grouping, date dividers, composer with image, optimistic send and retry, typing, seen | `client/src/pages/messages/*` |
| Entry points: profile and directory "Message", post "Offer help" and author menu | Various |

### M8. Notifications, reports, admin

| Task | Files |
|---|---|
| `notify()` with collapse and socket push; hooks in comments, accept, announcements, events, approvals | `server/services/notify.js` |
| Notifications routes; bell dropdown and page | `server/routes/notifications.js`, `client/src/components/notifications/*`, `client/src/pages/Notifications.jsx` |
| Reports route with auto-hide at 5; report modal | `server/routes/reports.js`, `client/src/components/ReportModal.jsx` |
| Admin routes and page (overview, pending faculty, reports, communities) | `server/routes/admin.js`, `client/src/pages/Admin.jsx` |

### M9. Search and polish

| Task | Files |
|---|---|
| Search route (posts FTS, users FTS, communities LIKE) and search page; top bar search with Enter to submit | `server/routes/search.js`, `client/src/pages/Search.jsx` |
| Empty, loading, error states audit against 03-APP-FLOW section 4 | All pages |
| Responsive pass at 360, 768, 1280 px | All pages |
| Accessibility pass (keyboard, labels, alt text, contrast) | All components |
| API integration tests for auth, permissions, uploads, DM privacy | `server/test/*.test.js` |
| Final seed, README screenshots, demo rehearsal | `server/seed`, `README.md` |

---

## 4. Team Plan (4 people)

| Person | Role | Owns |
|---|---|---|
| A | Backend lead | M1 server, posts/comments/communities APIs, permissions, tests |
| B | Frontend lead | App shell, feed, composer, post detail, comments UI |
| C | Full-stack (real-time) | Socket server, DMs end to end, notifications, directory and profiles |
| D | Design, data, demo | Tailwind tokens and component polish, seed dataset (07 guide), admin page UI, pitch deck, demo script, testing checklist |

Contract between A and B/C: the TRD API section. B and C can build against a small mock (`client/src/lib/mock.js`) until endpoints land, then switch.

### 4.1 Hackathon timeline (36 hours, team of 4)

| Hours | A (backend) | B (frontend) | C (real-time / people) | D (design / data / demo) |
|---|---|---|---|---|
| 0 to 2 | M0 server, DB, migrations | M0 client, Tailwind tokens, shell skeleton | Socket skeleton, users routes plan | Seed JSON v1, wireframe check |
| 2 to 8 | M1 auth + OTP | Auth pages, AuthContext | Directory + profile API | Seed JSON v2, avatars, poster images |
| 8 to 14 | M2/M3 posts API, uploads | Feed, PostCard, composer | Directory + profile UI | Seed loader with A, empty states copy |
| 14 to 18 | Sleep in shifts (2 h each) | | | |
| 18 to 24 | M4/M5 comments, communities, RSVP | Post detail, comments UI, community pages | M7 DMs end to end | Admin UI, report modal |
| 24 to 30 | M8 notifications, reports, admin API | Events rail, RSVP UI, polish | Notifications UI, badges, typing | Pitch deck, demo script, test checklist |
| 30 to 34 | Bug fixes, tests | Mobile pass | Bug fixes | Full demo rehearsal x2, record backup video |
| 34 to 36 | Freeze. Only fixes for demo path bugs | | | Final rehearsal |

### 4.2 Solo plan (one developer, about 6 working days)

| Day | Milestones |
|---|---|
| 1 | M0, M1 |
| 2 | M2, start M3 |
| 3 | Finish M3, M4 |
| 4 | M5, M6 |
| 5 | M7, M8 |
| 6 | M9, demo prep |

---

## 5. Engineering Workflow

| Topic | Rule |
|---|---|
| Branches | `main` always runs. Feature branches `feat/<milestone>-<short>` (for example `feat/m7-dms`), merged by pull request |
| Commits | Conventional style: `feat: add RSVP endpoint`, `fix: reject non-college email`, `docs: update TRD upload limits` |
| Reviews | One teammate approves; reviewer runs the app locally for UI changes |
| Environment | Node 20 or 22, npm; Windows PowerShell commands in README |
| Secrets | Only in `server/.env`; never committed |
| Definition of done (any task) | Matches PRD acceptance criteria; loading/empty/error states exist; works at 360 px; no console errors; API changes reflected in TRD |

---

## 6. Cut List (if behind schedule)

Cut from the top first. Items below the line are never cut.

| Order | Cut | Fallback |
|---|---|---|
| 1 | Global search | Directory search still works |
| 2 | RSVP CSV export | Show RSVP list in a modal |
| 3 | Typing indicator and Seen | Messages still real time |
| 4 | Notification collapsing | One notification per event |
| 5 | Community creation requests | Communities only from seed and admins |
| 6 | Report auto-hide | Admin removes manually |
| 7 | Forgot password | Admin reset via seed script |
| 8 | Draft autosave in composer | |
| 9 | Dark mode | Light only (already the default) |
| **Never cut** | College-email registration, feed with 7 types, doubt accept, request fulfil, lost/found resolve, announcements, club event in global Events tab + RSVP, communities join, directory with cabin, senior connect, comment images, real-time DMs with images | |

---

## 7. Demo Script (4 minutes)

Use two browser windows side by side: left logged in as **Aarav (1st year AIML)**, right as **Sneha (3rd year CSE, GDGC lead)**. A third tab is pre-logged as **Prof. Kulkarni**.

| Time | Action | Message to judges |
|---|---|---|
| 0:00 | Show register screen, type a gmail address, show the error; type `@dypiu.ac.in`, show OTP arriving in the server console, finish registration | Only verified college members can join |
| 0:40 | Home: point at the pinned faculty announcement and the Upcoming events rail | One place for everything on campus |
| 1:00 | Sneha posts a GDGC Event with poster; Aarav (not a GDGC member) sees it in Events and taps Going; Sneha sees the count change | Solves the "nobody knew about the GDGC event" problem |
| 1:40 | Aarav posts a Doubt with a photo; Prof. Kulkarni answers with a screenshot in the comment; Aarav accepts the answer | Doubt forum with trusted faculty answers |
| 2:20 | Aarav posts a Request "Need a calculator, exam at 2 PM"; Sneha taps Offer help and sends a DM with a photo; message appears instantly on the left | Real-time DMs with images |
| 3:00 | Aarav opens Directory, filters Faculty, AIML, Teaches year 3, sees "Block A, Room 304" on the card | Find any teacher's cabin in seconds |
| 3:20 | Seniors tab: shows Sneha "Open to mentor", tap Message | Senior-junior connection |
| 3:40 | Close on Lost & Found tab with a resolved item and the admin dashboard (pending faculty) | Safe, moderated, real campus use |

Backup: a recorded screen video of the same script, in case of Wi-Fi failure.

---

## 8. Testing Checklist (manual, before demo)

**Auth**
- [ ] Non-college email rejected on client and server
- [ ] Subdomain email (`x@abc.dypiu.ac.in`) accepted
- [ ] OTP: wrong code count, lock after 5, expiry, resend cooldown
- [ ] Teacher registers as pending; announcement disabled with reason
- [ ] Session survives refresh; logout clears it; 401 redirects to login with `next`

**Posts**
- [ ] Each of the 7 types can be created by an allowed user and is refused (403) for a disallowed one
- [ ] 4 images upload; 5th refused; 6 MB refused; `.exe` renamed to `.png` refused
- [ ] Edit within 24 h works; after 24 h refused
- [ ] Votes: up, down, remove; cannot vote own post
- [ ] Doubt accept and change; request fulfil; lost/found resolve locks comments
- [ ] Pinned announcement shows on top; disappears after `pinned_until`

**Comments**
- [ ] Text only, image only, both
- [ ] Reply to reply stays at depth 1 with @mention
- [ ] Delete with replies shows "[deleted]"

**Communities and events**
- [ ] Auto-joined to department and batch on register
- [ ] Non-member can read, cannot post or comment
- [ ] Event appears in global Events tab and rail for non-members
- [ ] RSVP toggle and counts; CSV downloads with names

**Directory and profiles**
- [ ] Search by cabin number finds the teacher
- [ ] Teaches-year filter works
- [ ] Seniors tab shows only more-senior students with mentor on
- [ ] Avatar upload and profile edits persist

**DMs**
- [ ] Message arrives in the other window in under 1 s
- [ ] Image message shows thumbnail and opens lightbox
- [ ] Unread badge increments and clears on open
- [ ] Offline send shows "Not sent. Retry" and retry works
- [ ] Blocked user cannot send
- [ ] A third user cannot fetch the conversation (403)

**Admin and safety**
- [ ] Approve teacher unlocks announcements live (no re-login)
- [ ] Report, remove content, suspend user; suspended user cannot log in

**Cross-cutting**
- [ ] 360 px mobile pass on all main pages
- [ ] Keyboard-only: register, post, comment with image, DM
- [ ] No console errors on any page

---

## 9. Risks During Build

| Risk | Mitigation |
|---|---|
| Native SQLite driver fails to install on Windows | Resolved: the build uses Node's built-in `node:sqlite`, so there is nothing to compile |
| Campus Wi-Fi blocks WebSockets at the venue | Socket.IO falls back to long polling automatically; test on a phone hotspot too |
| SMTP not ready | Console OTP in dev mode is part of the demo story |
| Time overrun on DMs | Start M7 by hour 18 at the latest; typing and seen are on the cut list |
| Merge conflicts in shared files (`App.jsx`, `posts.js`) | Route files per feature; `App.jsx` route list edited by one person at a time |

---

## 10. After the Hackathon

1. Pilot with one department for 4 weeks (P1 features, real SMTP).
2. Move uploads to object storage with resizing (`sharp`).
3. PWA install and web push for DMs and announcements.
4. PostgreSQL migration when active users exceed about 2,000 concurrent.
5. Event reminders, polls, dark mode, email digest.
