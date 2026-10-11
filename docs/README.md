# Campus Connect

**One verified space for everything happening on campus.**

Campus Connect is a college-only social platform for DYPIU. It brings the campus feed, a doubt forum, lost and found, borrow requests, faculty announcements, club events, communities, direct messages, and a faculty and student directory into one web app. Only people with a college email ending in `dypiu.ac.in` can join.

---

## The Problem

- A GDGC event was held on campus and most students never heard about it.
- Doubts get buried in noisy class WhatsApp groups.
- Lost items are announced in one group while the finder is in another.
- A student needing a calculator 10 minutes before an exam has nowhere to ask.
- First-years cannot find a teacher's cabin or a senior to ask for advice.

## The Solution

| Feature | What it does |
|---|---|
| College-only access | Register with your `@dypiu.ac.in` email, verified by a one-time code |
| Campus feed | One home page with tabs: All, Announcements, Events, Doubts, Requests, Lost & Found |
| Doubt forum | Ask with a photo, get answers from classmates, seniors, and faculty, accept the best answer |
| Lost and found | Post what you lost or found with location, date, and photo; mark resolved |
| Requests | "Need a calculator" style posts; helpers reply or tap Offer help to DM |
| Announcements | Verified faculty post campus-wide or to a batch; pinned to the top |
| Club events | Clubs post events that every student sees, with one-tap RSVP and attendee export |
| Communities | Clubs, departments, batches, and interest groups, each with its own feed |
| Direct messages | Real-time 1:1 chat with image sharing |
| Images everywhere | Attach images to posts, comments, and messages |
| Directory | Search students and faculty; faculty cards show cabin number and office hours |
| Senior connect | Seniors can mark themselves "Open to mentor" so juniors can reach out |
| Moderation | Reports, admin review, teacher verification, blocking |

## Tech Stack

React 18, Vite, Tailwind CSS, React Router, Socket.IO client, and an installable PWA (vite-plugin-pwa) on the frontend. Node.js 22+, Express, SQLite (Node's built-in `node:sqlite`), Socket.IO, JWT in httpOnly cookies, Multer, Nodemailer on the backend.

---

## Documentation

| # | Document | Contents |
|---|---|---|
| 01 | [PRD](01-PRD.md) | Problem, personas, goals, every feature with acceptance criteria, permissions matrix, metrics, risks |
| 02 | [TRD](02-TRD.md) | Stack, repo layout, config, auth design, full API reference, real-time protocol, uploads, ranking, security, testing |
| 03 | [App Flow](03-APP-FLOW.md) | Screen inventory, navigation map, step-by-step flows with diagrams, states, deep links |
| 04 | [UI/UX Brief](04-UIUX-BRIEF.md) | Design principles, tokens, layouts, components, screen wireframes, microcopy, accessibility |
| 05 | [Backend Schema](05-BACKEND-SCHEMA.md) | ER diagram, full SQL DDL, indexes, FTS search, key queries, transactions, retention |
| 06 | [Implementation Plan](06-IMPLEMENTATION-PLAN.md) | Milestones, task breakdown, team split, 36-hour timeline, cut list, demo script, test checklist |
| 07 | [Dataset Guide](07-DATASET-GUIDE.md) | Seed and reference data formats, demo accounts, real faculty data collection, privacy, validation |
| | [Architecture](architecture.md) | System diagram, request, auth, messaging, upload flows, deployment, scaling, security boundaries |

Diagrams are written in Mermaid and render on GitHub and in VS Code with a Mermaid preview extension.

---

## Quick Start (Windows PowerShell)

Requirements: Node.js 22.13 or newer (24 recommended), npm.

Server:

```powershell
cd C:\DH\server
npm install
Copy-Item .env.example .env
npm run db:reset
npm run seed
npm run dev
```

Client (second terminal):

```powershell
cd C:\DH\client
npm install
npm run dev
```

Open http://localhost:5173.

Without SMTP settings in `.env`, registration codes are printed in the server terminal. Demo accounts are listed in [07-DATASET-GUIDE.md](07-DATASET-GUIDE.md#42-demo-accounts) and use the `SEED_PASSWORD` from your `.env`.

---

## Project Structure

```
C:\DH
|-- docs\       Specification (you are here)
|-- server\     Express API, Socket.IO, SQLite, uploads, seed data
|-- client\     React + Vite + Tailwind single-page app
```

See [02-TRD.md, section 4](02-TRD.md#4-repository-structure) for the full layout.

---

## Status

| Area | Status |
|---|---|
| Specification (this folder) | Complete for MVP |
| Server | MVP built: all P0 features plus notifications, reports, admin, search, blocking; 11 API tests passing |
| Client | MVP built: responsive web app and installable PWA |
| Not yet built | Dark mode, event reminders, polls, image resizing, pilot faculty CSV import, per-community report queue |
