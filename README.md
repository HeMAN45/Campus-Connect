# Campus Connect

A college-only social platform for DYPIU: one verified place for doubts, club events, faculty announcements, lost and found, borrow requests, communities, direct messages, and a faculty and student directory. It runs as a responsive website and installs as an app (PWA) on phones and laptops.

Only email addresses ending in `dypiu.ac.in` (including subdomains) can register, verified with a 6-digit OTP code.

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

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL (Neon for production) |
| Auth | JWT sessions in HttpOnly cookies, bcrypt, email OTP |
| Search | PostgreSQL full-text search (tsvector + GIN indexes) |
| PWA | vite-plugin-pwa, Workbox service worker |

## Run it locally

**Requirements:** Node.js 18 or newer, PostgreSQL 14+.

### 1. Set up the database

Create a PostgreSQL database:

```powershell
createdb campus_connect
```

### 2. Start the server

```powershell
cd C:\DH\server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` and set `DATABASE_URL` to your local PostgreSQL connection string if it differs from the default (`postgresql://localhost:5432/campus_connect`). Then:

```powershell
npm run dev
```

The server runs migrations automatically on startup.

### 3. Start the client

In a second terminal:

```powershell
cd C:\DH\client
npm install
npm run dev
```

Open http://localhost:5173. Sign-up codes are printed in the server terminal when no SMTP server is configured.

### Reset the database

To drop and recreate all tables:

```powershell
cd C:\DH\server
npm run db:reset
```

## Install as a PWA

The service worker is only active in a production build. Build the client, then the API server serves the app:

```powershell
cd C:\DH\client
npm run build
cd C:\DH\server
npm start
```

Open http://localhost:4000 in Chrome or Edge and use the install icon in the address bar.

On a phone, the app must be served over HTTPS to be installable (browsers allow service workers only on HTTPS or localhost).

### PWA features

- **Offline shell**: The app shell (HTML, CSS, JS, fonts) is precached. You can open the app offline and see the last-loaded UI.
- **Image caching**: Uploaded images are cached with a CacheFirst strategy (up to 400 images, 30 days).
- **Auto-update**: When a new version is deployed, the service worker updates in the background. The next page load uses the new version.
- **Home screen install**: On Android Chrome, you get an "Add to Home Screen" prompt. On iOS Safari, use Share > Add to Home Screen. On desktop Chrome/Edge, click the install icon in the address bar.

## Deploy to Vercel with Neon

### 1. Create a Neon database

Sign up at [neon.tech](https://neon.tech) and create a new project. Copy the connection string.

### 2. Deploy

```powershell
npm install -g vercel
cd C:\DH
vercel
```

Set these environment variables in the Vercel dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | A random 32+ character string |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | Your Vercel app URL (e.g. `https://campus-connect.vercel.app`) |
| `ALLOWED_EMAIL_DOMAIN` | `dypiu.ac.in` |

Optional: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` for email OTP delivery.

### 3. Run migrations

The server runs migrations automatically on startup. After the first deploy, visit `/api/health` to confirm the database is connected.

**Note:** Socket.IO (real-time messages and typing indicators) does not work on Vercel's serverless functions. Messages still work via HTTP polling. For real-time features, deploy the server to a persistent host (Railway, Render, a VPS) alongside the Neon database.

## Tests

Tests require a running PostgreSQL instance. Set `TEST_DATABASE_URL` or use the default `campus_connect_test` database:

```powershell
createdb campus_connect_test
cd C:\DH\server
npm test
```

Runs the API tests: email domain rules, permissions, uploads, accepted answers, DM privacy and blocking, directory, admin approvals.

## Project layout

```
server/   Express API, Socket.IO, PostgreSQL migrations, tests
client/   React + Vite + Tailwind app, PWA config, icons
docs/     Product and technical specification
```

Start with [docs/README.md](docs/README.md) for the full specification.
