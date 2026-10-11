# Campus Connect

A college-only social platform for DYPIU: one verified place for doubts, club events, faculty announcements, lost and found, borrow requests, communities, direct messages, and a faculty and student directory. It runs as a responsive website and installs as an app (PWA) on phones and laptops.

Only email addresses ending in `dypiu.ac.in` (including subdomains) can register, verified with a 6-digit code.

## Features

- **Campus feed** with tabs: All, Announcements, Events, Doubts, Requests, Lost & Found
- **Doubt forum**: ask with screenshots, answers from classmates, seniors, and faculty, accept the best answer
- **Requests** ("need a calculator for the 2 PM exam") with one-tap **Offer help** that opens a DM
- **Lost and found** with location, date, photo, and resolve flow
- **Faculty announcements** to the whole campus or a batch, pinnable, with notifications
- **Club events** visible to every student, one-tap RSVP, attendee list and CSV export
- **Communities**: clubs, departments, batches (auto-joined), interest groups, roles and moderation
- **Direct messages** in real time with images, typing indicator, read receipts, retry on failure
- **Images** in posts (up to 4), comments, and messages
- **Directory**: search people by name, subject, skill, or cabin number; faculty cards show cabin and office hours
- **Senior connect**: seniors mark themselves "Open to mentor" with topics; juniors message them
- **Safety**: faculty verification by admin, reports, auto-hide, suspensions, blocking
- **PWA**: install to home screen, offline app shell, cached images

## Run it locally (Windows PowerShell)

Requirements: Node.js 22.13 or newer (24 recommended).

First time, in one terminal:

```powershell
cd C:\DH\server
npm install
Copy-Item .env.example .env
npm run db:reset
npm run seed
npm run dev
```

In a second terminal:

```powershell
cd C:\DH\client
npm install
npm run dev
```

Open http://localhost:5173. Sign-up codes are printed in the server terminal when no SMTP server is configured.

### Demo accounts

All seeded accounts use the `SEED_PASSWORD` value from `server/.env`.

| Who | Email |
|---|---|
| First-year AIML student | `demo.aarav@dypiu.ac.in` |
| Third-year CSE student, GDGC club lead, mentor | `demo.sneha@dypiu.ac.in` |
| Final-year AIML student, mentor | `demo.rohan@dypiu.ac.in` |
| Verified faculty, AIML, cabin Block A Room 304 | `demo.rkulkarni@dypiu.ac.in` |
| Verified faculty, CSE | `demo.miyer@dypiu.ac.in` |
| Faculty awaiting verification | `demo.ajoshi@dypiu.ac.in` |
| Platform admin | `demo.admin@dypiu.ac.in` |

## Production and installable app

The service worker is only active in a production build. Build the client, then the API server also serves the app:

```powershell
cd C:\DH\client
npm run build
cd C:\DH\server
npm start
```

Open http://localhost:4000 in Chrome or Edge and use the install icon in the address bar. On a phone, the app must be served over HTTPS to be installable (browsers allow service workers only on HTTPS or localhost). See [docs/architecture.md](docs/architecture.md) for deployment.

## Tests

```powershell
cd C:\DH\server
npm test
```

Runs the API tests against an in-memory database: email domain rules, permissions, uploads, accepted answers, DM privacy and blocking, directory, admin approvals.

## Project layout

```
docs/     Product and technical specification (PRD, TRD, flows, UI brief, schema, plan, dataset, architecture)
server/   Express API, Socket.IO, SQLite migrations, seed data, tests
client/   React + Vite + Tailwind app, PWA config, icons
```

Start with [docs/README.md](docs/README.md) for the full specification.
