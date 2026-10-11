# 01. Product Requirements Document (PRD)

**Product:** Campus Connect
**Tagline:** One verified space for everything happening on campus.
**Version:** 1.0 (MVP)
**Status:** Approved for build
**Owner:** Himanshu Bawane
**Last updated:** 2026-10-11

---

## 1. Summary

Campus Connect is a college-only social platform for D Y Patil International University (DYPIU). It combines a Reddit-style discussion forum, an X-style live feed, and a WhatsApp-style direct messenger into one web app. Only people holding a verified college email address (ending in `dypiu.ac.in`) can register, so every post, answer, and message comes from a real member of the campus.

The MVP covers: a unified campus feed, a doubt forum, lost and found, borrow/lend requests, teacher and club announcements, club events with RSVP, communities, direct messages, a searchable student and faculty directory with profile pages (including faculty cabin numbers), and senior-junior connection. Users can attach images to posts, comments, and direct messages.

---

## 2. Problem Statement

Campus information today lives in dozens of disconnected places: class WhatsApp groups, club Instagram pages, notice boards, emails, and word of mouth. This causes real, repeated failures:

| # | Observed problem | Real example | Cost |
|---|---|---|---|
| P1 | Club events reach only the club's own followers | A GDGC event was hosted on campus and most students did not know it happened | Low turnout, wasted organizer effort, students miss opportunities |
| P2 | Academic doubts get lost in noisy class groups | A DBMS doubt posted at night is buried under 200 messages by morning | Students stay stuck, the same doubt is asked again and again |
| P3 | Lost items have no common channel | A lost ID card is announced in one group while the finder is in another | Items are never returned |
| P4 | Small, urgent needs have no outlet | A student needs a calculator 10 minutes before an exam | Panic, missed exam marks |
| P5 | Juniors cannot find faculty | A first-year student wants to meet a third-year AIML teacher but does not know the cabin, block, or office hours | Wasted time walking between buildings, hesitation to ask |
| P6 | Juniors have no path to seniors | First-years want advice on electives, internships, and clubs but know no seniors | Repeated mistakes, weak campus community |
| P7 | Teacher announcements are fragmented | A schedule change is told to one section verbally and never reaches another | Missed classes and deadlines |

**Root cause:** there is no single, trusted, campus-wide channel where anyone verified can post and everyone can discover.

---

## 3. Goals and Non-Goals

### 3.1 Goals (MVP)

| ID | Goal | Measured by |
|---|---|---|
| G1 | Give every verified member one place to see what is happening on campus | Daily active users / registered users |
| G2 | Make club events discoverable by all students, not only club followers | Event RSVP count vs club member count |
| G3 | Get academic doubts answered quickly | Median time to first answer on doubt posts |
| G4 | Return lost items and fulfil small requests | Percentage of lost/found and request posts marked resolved |
| G5 | Make every faculty member findable in under 30 seconds | Directory search to profile open time |
| G6 | Connect juniors with seniors who are willing to help | DM threads started from "Open to mentor" profiles |
| G7 | Keep the platform trustworthy | Zero non-college accounts; reports handled within 24 hours |

### 3.2 Non-Goals (explicitly out of MVP)

- Attendance, marks, timetable, or any ERP integration
- Video or voice calls
- Group chats inside DMs (communities cover group discussion)
- Anonymous posting
- Native Android or iOS apps (the web app is responsive and installable as a PWA later)
- Payments, marketplace transactions, or selling
- Multi-college support (the domain is configurable, but MVP targets one college)
- AI features (auto answers, summarization)

---

## 4. Target Users and Personas

### 4.1 User roles

| Role | Who | How they get the role |
|---|---|---|
| Student | Any enrolled student | Registers with a college email, chooses "Student" |
| Teacher | Faculty and staff | Registers with a college email, chooses "Teacher", then a platform admin approves |
| Community admin / moderator | Club leads, class representatives, department coordinators | Assigned per community by the community creator or a platform admin |
| Platform admin | Student affairs office or the project team | Seeded at install time |

A club is not a separate account type. A club is a community of type `club`, and the club leads are that community's admins. This keeps accounts tied to real people and keeps accountability clear.

### 4.2 Personas

**Aarav, first-year B.Tech AIML student**
- New to campus, knows almost nobody outside the section.
- Wants to find the AIML faculty cabin, learn about clubs, and ask doubts without feeling judged in a big group.
- Success for Aarav: "I found Prof. Kulkarni's cabin and office hours in 20 seconds and a senior explained which electives to pick."

**Sneha, third-year CSE student and GDGC lead**
- Runs club events and struggles to reach students beyond the club's followers.
- Wants one post to reach the whole campus, and wants to know how many people are coming.
- Success for Sneha: "Our event post showed up on everyone's home page and 140 people RSVPed."

**Prof. Kulkarni, Assistant Professor, AIML department**
- Teaches third-year AIML, gets the same doubt in five different chats.
- Wants to post announcements to a batch or the whole campus and answer a doubt once for everyone.
- Success: "I answered the backpropagation doubt once, marked it accepted, and nobody asked again."

**Riya, second-year student who lost an ID card**
- Needs to reach the whole campus fast, with a photo of a similar card and the place it was lost.
- Success: "The finder saw my post, sent me a DM with a photo, and I got it back by lunch."

**Student Affairs Admin**
- Needs to approve teacher accounts, remove abusive content, and see reports.
- Success: "I cleared the report queue in five minutes from one admin page."

---

## 5. Scope and Prioritization

Priority meaning: **P0** must ship in the MVP demo, **P1** should ship if time allows, **P2** future.

| ID | Feature | Priority | User request # |
|---|---|---|---|
| F1 | College-email-only registration with OTP verification | P0 | 5 |
| F2 | Profiles for students and teachers (including cabin number, office hours) | P0 | 11 |
| F3 | Unified campus feed (Campus Connect home) | P0 | 3, 12 |
| F4 | Post types: General, Doubt, Request, Lost, Found, Announcement, Event | P0 | 1, 2, 4, 6, 7 |
| F5 | Doubt forum with accepted answers | P0 | 1 |
| F6 | Lost and found with resolve flow | P0 | 2 |
| F7 | Borrow/lend requests with "fulfilled" flow | P0 | 7 |
| F8 | Teacher announcements (campus-wide or to a community) | P0 | 4 |
| F9 | Club events with date, venue, RSVP, and campus-wide visibility | P0 | 6 |
| F10 | Communities (clubs, departments, batches, interest groups) | P0 | 9 |
| F11 | Comments with threaded replies and image attachments | P0 | 12, images |
| F12 | Direct messages, real-time, with image attachments | P0 | 8, images |
| F13 | Directory search for students and faculty | P0 | 10, 11 |
| F14 | Senior connect ("Open to mentor juniors" + filters) | P0 | 10 |
| F15 | Upvotes / downvotes on posts and comments | P0 | 12 |
| F16 | In-app notifications | P1 | |
| F17 | Report content and admin moderation queue | P1 | |
| F18 | Teacher approval by platform admin | P0 | |
| F19 | Global search (posts, people, communities) | P1 | |
| F20 | Block a user from DMing you | P1 | |
| F21 | Email digests, push notifications, PWA install | P2 | |
| F22 | Event reminders 1 hour before start | P2 | |
| F23 | Polls in posts | P2 | |

---

## 6. Detailed Feature Requirements

Each feature lists user stories and acceptance criteria (AC). AC are written so they can be tested directly.

### F1. College-email-only registration with OTP

**User stories**
- As a student, I want to sign up with my college email so that everyone on the platform is from my college.
- As the college, we want no outsiders on the platform, so that it is safe and relevant.

**Flow:** enter email -> receive 6-digit OTP -> enter OTP -> set name and password -> choose role -> complete profile.

**Acceptance criteria**
1. The email must match the allowed domain: `name@dypiu.ac.in` or any subdomain such as `name@xxx.dypiu.ac.in`. Matching is case-insensitive. Any other email shows: "Use your college email ending in dypiu.ac.in."
2. A 6-digit OTP is sent to the email. It expires in 10 minutes.
3. A wrong OTP can be tried at most 5 times, then the user must request a new one.
4. A new OTP can be requested only after 60 seconds, and at most 5 times per email per hour.
5. If an account already exists for the email, the screen says "You already have an account. Log in instead." and links to login.
6. Password must be at least 8 characters and contain at least one letter and one number.
7. The OTP is never stored in plain text and never returned by the API.
8. In development mode with no mail server configured, the OTP is printed in the server console and shown on the verify screen with a "Development mode" label, so the team can demo without email. This never happens when `NODE_ENV=production` or when SMTP is set.
9. Choosing "Teacher" creates the account in `pending` status. The user can browse, comment, and DM, but cannot post announcements until an admin approves. A banner explains this.
10. After registration, students are auto-joined to their department community and batch community (example: "AIML", "AIML 2024 Batch").

### F2. Profiles

**User stories**
- As a first-year student, I want to open a teacher's profile and see their department, subjects, cabin number, and office hours, so that I can meet them.
- As a senior, I want to show my skills and that I am open to mentoring.

**Profile fields**

| Field | Student | Teacher | Visibility |
|---|---|---|---|
| Name | Required | Required | Everyone |
| College email | Auto | Auto | Everyone (teachers), only to logged-in users (students) |
| Profile photo | Optional | Optional | Everyone |
| Department | Required | Required | Everyone |
| Program (B.Tech, BCA, MBA...) | Required | No | Everyone |
| Year of study (1 to 5) | Required | No | Everyone |
| Section | Optional | No | Everyone |
| Graduation year | Auto from year | No | Everyone |
| Designation (Assistant Professor...) | No | Required | Everyone |
| Cabin / office location (example: "Block A, Room 304") | No | Required | Everyone |
| Office hours (example: "Mon, Wed 2:00 to 4:00 PM") | No | Optional | Everyone |
| Subjects taught | No | Optional (list) | Everyone |
| Bio (max 300 chars) | Optional | Optional | Everyone |
| Skills (list, max 15) | Optional | Optional | Everyone |
| GitHub, LinkedIn links | Optional | Optional | Everyone |
| Open to mentor juniors (toggle) | Optional (year 2 and above) | Optional | Everyone |
| Enrollment number | Optional | No | Only the user and admins |

**Acceptance criteria**
1. Profile page shows header (photo, name, role badge, department, year or designation), an "About" block, a "Contact" block (cabin, office hours, email for teachers), and tabs for Posts and Communities.
2. A "Message" button on every profile except your own opens or creates the DM conversation.
3. Teachers show a "Faculty" badge; verified teachers show "Faculty, verified".
4. Users edit their own profile from Settings. Email and role cannot be changed by the user.
5. Phone numbers are not collected anywhere.

### F3. Unified campus feed (Campus Connect home)

**User stories**
- As a student, I want one home page where I see announcements, events, doubts, requests, and lost items from across the campus.

**Acceptance criteria**
1. The home feed shows posts from all public communities plus campus-wide posts.
2. Tabs or filter chips: **All**, **Announcements**, **Events**, **Doubts**, **Requests**, **Lost & Found**.
3. Sort options: **Hot** (default), **New**, **Top (this week)**.
4. Pinned campus-wide announcements appear at the top of the All tab, with a "Pinned" label, for up to 7 days.
5. A right-side rail on desktop shows "Upcoming events" (next 5 events by start time) and "Pinned announcements".
6. The feed loads 20 posts at a time with infinite scroll.
7. Each post card shows: author name and role badge, community name (if any), relative time, type label, title, first 3 lines of body, first image thumbnail, vote score, comment count, and type-specific info (event date, lost location, request status).
8. Resolved lost, found, and request posts show a "Resolved" label and are moved below open posts in their own tab.

### F4. Post types

| Type | Who can create | Extra fields | Status flow |
|---|---|---|---|
| General | Any active user | None | Open only |
| Doubt | Any active user | Subject tag (example: "DBMS") | Open -> Answered (accepted answer) |
| Request | Any active user | Needed by (date/time, optional) | Open -> Fulfilled |
| Lost | Any active user | Where lost, when lost | Open -> Resolved (found) |
| Found | Any active user | Where found, when found | Open -> Resolved (returned) |
| Announcement | Verified teachers, platform admins (campus-wide); community admins and moderators (inside their community) | Pin (optional) | Open only |
| Event | Community admins and moderators (inside their community), verified teachers, platform admins | Start date/time (required), end date/time, venue (required), registration link (optional) | Upcoming -> Ongoing -> Past (computed from time) |

**Common rules**
1. Title: 3 to 150 characters. Body: up to 5,000 characters, plain text with line breaks and auto-linked URLs.
2. Up to 4 images per post (JPEG, PNG, WebP, GIF), max 5 MB each.
3. A post may be campus-wide (no community) or belong to one community. Only members can post inside a community.
4. Authors can edit title and body within 24 hours and delete their post at any time. Edited posts show "edited".
5. Only the author (or an admin) can mark a post resolved.

### F5. Doubt forum

**User stories**
- As a student, I want to post a doubt with a screenshot of the problem and get answers from classmates, seniors, and teachers.
- As a teacher, I want my answer to be clearly marked so students trust it.

**Acceptance criteria**
1. Doubt posts require a subject tag chosen from a list (seeded per department) or typed freely (max 30 chars).
2. Answers are comments. Comments by teachers show a "Faculty" badge.
3. The doubt author can mark one comment as **Accepted answer**. It is pinned directly below the post with a green "Accepted" label. The author can change it.
4. The Doubts tab can be filtered by subject tag and by "Unanswered" (zero comments) to help helpers find open doubts.
5. Accepting an answer notifies the answer's author.

### F6. Lost and found

**Acceptance criteria**
1. Lost and Found are separate post types so the feed can label them clearly ("Lost" in red, "Found" in green).
2. Location and date fields are required for both.
3. A photo is strongly encouraged: the composer shows a hint "Posts with photos are resolved 3x faster" (copy only, not a measured claim in the product).
4. The author marks the post **Resolved**. Resolved posts keep their comments but stop accepting new ones.
5. The Lost & Found tab shows open items first, newest first.

### F7. Borrow and lend requests

Example: "Need a scientific calculator for the 2 PM exam, Block B."

**Acceptance criteria**
1. Request posts show a "Request" label and an optional "Needed by" time. If the time has passed and it is still open, the card shows "Expired" in muted text.
2. Helpers can reply in comments or tap **Offer help**, which opens a DM with the author pre-filled with "Hi, I can help with: <post title>".
3. The author marks the request **Fulfilled**.
4. Requests for money, alcohol, or exam answers are against the rules and can be reported (listed in community guidelines).

### F8. Teacher announcements

**Acceptance criteria**
1. Verified teachers and platform admins can post campus-wide announcements. Community admins and moderators can post announcements inside their community.
2. Announcements can be pinned. Campus-wide pins last up to 7 days; community pins until unpinned.
3. Creating a campus-wide announcement sends an in-app notification to every active user. A community announcement notifies that community's members.
4. Announcements show an "Announcement" label and the author's designation.
5. Comments on announcements can be turned off by the author.

### F9. Club events (the GDGC problem)

**User stories**
- As a club lead, I want my event to appear on every student's home page, not only to club members.
- As a student, I want to see upcoming events and RSVP in one tap.

**Acceptance criteria**
1. Event posts are created inside the club's community by its admins or moderators.
2. Every event appears in the global **Events** tab and the "Upcoming events" rail for all users, regardless of membership.
3. Event card shows: title, club name, date and time, venue, RSVP count, and **Going** / **Interested** buttons.
4. RSVP is one tap. The user can change or remove it. The author sees the full RSVP list with names and can export it as CSV.
5. When an event is created, all members of the club community get a notification. Users who are not members see it in the feed and rail.
6. Events in the past move to a "Past events" section on the community page and leave the rail.
7. Optional registration link opens in a new tab.

### F10. Communities

**Types**

| Type | Example | Created by | Membership |
|---|---|---|---|
| Official | "DYPIU Announcements", "Placement Cell" | Platform admin | Everyone auto-joined (Official), posting restricted to admins and moderators |
| Department | "AIML", "CSE", "Mechanical" | Seeded | Auto-join by department, anyone may join |
| Batch | "AIML 2024 Batch" | Seeded or auto-created on first registration of that batch | Auto-join by department + graduation year |
| Club | "GDGC", "Robotics Club" | Verified teachers or admins directly; students by request, approved by admin | Open join |
| Interest | "Competitive Programming", "Photography" | Any user by request, approved by admin | Open join |

**Acceptance criteria**
1. Communities page lists all communities with filters by type, a search box, and member counts.
2. Community page shows: cover, avatar, name, type badge, description, member count, Join/Leave button, feed of the community's posts, an "About" tab with rules and the list of admins/moderators, and an "Events" tab for clubs.
3. Anyone can read a community. Only members can post or comment in it.
4. Community admins can promote members to moderator, remove posts in the community, pin posts, and edit the community description and images.
5. A user can be a member of any number of communities.

### F11. Comments with images

**Acceptance criteria**
1. Users can comment on any post that is not locked. A comment has text (up to 2,000 chars), an image, or both.
2. One image per comment, JPEG/PNG/WebP/GIF, max 5 MB. The composer shows a preview with a remove button before sending.
3. Replies are threaded to a depth of 2 (comment -> reply). Deeper replies attach to the depth-2 parent and mention the user being replied to.
4. Comments can be upvoted/downvoted. Sort: Top (default) or New.
5. Authors can delete their comments. Deleted comments with replies show "[deleted]" to keep the thread readable.
6. Clicking an image opens a full-screen viewer (lightbox), closable with Esc or a close button.

### F12. Direct messages with images

**Acceptance criteria**
1. Any active user can start a 1:1 conversation from a profile, from the directory, from a post's author menu, or from "Offer help" on a request.
2. Messages arrive in real time without refreshing (under 1 second on campus Wi-Fi).
3. A message has text (up to 2,000 chars), one image (max 5 MB), or both.
4. The conversation list shows the other person's name and photo, the last message preview ("Photo" if image-only), relative time, and an unread count.
5. The top navigation shows a total unread messages badge.
6. Typing indicator ("typing...") shows while the other person types.
7. Messages load newest first, 30 at a time, with older ones loaded on scroll up.
8. A user can block another user. Blocked users cannot send DMs to the blocker; the UI says "You can't message this person."
9. Messages are visible only to the two participants. Platform admins can see a message only when it has been reported.

### F13. Directory

**User stories**
- As a first-year student, I want to search "AIML" and filter by "Faculty" and "teaches 3rd year" to find the right teacher and their cabin.

**Acceptance criteria**
1. Directory page has a search box (matches name, department, subjects, skills, cabin) and filters: Role (All, Students, Faculty), Department, Year (students), "Open to mentor".
2. Results show compact cards: photo, name, role badge, department, year or designation, and for faculty the cabin location shown directly on the card.
3. Clicking a card opens the profile. Each card has a "Message" button.
4. Results update as the user types (debounced 300 ms), 24 per page.
5. Faculty subjects include the year they teach (example: "Deep Learning (3rd year AIML)") so the filter "Teaches year" works.

### F14. Senior connect

**Acceptance criteria**
1. Students in year 2 or above can switch on "Open to mentor juniors" and pick topics (Electives, Internships, Placements, Clubs, Competitive programming, Research, Hostel life).
2. A "Connect with seniors" panel in the Directory filters to students with the toggle on, more senior than the viewer, sortable by department match first.
3. Profiles with the toggle on show an "Open to mentor" badge and the chosen topics.
4. The "Message" button on these profiles opens a DM with a starter prompt the user can edit.

### F15. Voting

1. One vote per user per post or comment: up, down, or none. Clicking the active vote again removes it.
2. Score = upvotes minus downvotes, shown on the card.
3. Users cannot vote on their own content.

### F16. Notifications (P1)

Notification triggers:

| Trigger | Who is notified |
|---|---|
| Someone comments on my post | Post author |
| Someone replies to my comment | Comment author |
| My answer is accepted | Answer author |
| A new campus-wide announcement | All active users |
| A new announcement or event in a community I belong to | Community members |
| My teacher account is approved | The teacher |
| My community request is approved or rejected | The requester |

1. A bell icon shows the unread count. The panel lists the latest 50 notifications with "Mark all as read".
2. Clicking a notification opens the relevant post or profile and marks it read.
3. Notifications are pushed in real time over the same socket as DMs.

### F17. Reporting and moderation (P1)

1. Any post, comment, message, or profile can be reported with a reason: Spam, Harassment, Inappropriate content, Misinformation, Other (with text).
2. A post with 5 or more distinct open reports is auto-hidden pending review.
3. Admin page lists open reports, newest first, with the reported content shown inline and actions: Dismiss, Remove content, Suspend user (7 days, 30 days, permanent).
4. Community moderators see reports for content in their community and can remove it.
5. Suspended users cannot log in and see the suspension end date.

### F18. Teacher approval

1. Admin page has a "Pending faculty" list with name, email, department, designation, and cabin.
2. Approve sets status to `active` and sends a notification. Reject converts the account to a student-level account in `active` status with a notification explaining why.

### F19. Global search (P1)

One search box in the top bar returns three groups: Posts (title and body), People (name, skills, subjects), Communities (name, description). Up to 5 results per group, with "See all" links.

### F20. Blocking (P1)

See F12 AC 8. A blocked user also cannot see the blocker in DM search.

---

## 7. Roles and Permissions Matrix

| Action | Student | Teacher (pending) | Teacher (verified) | Community moderator | Community admin | Platform admin |
|---|---|---|---|---|---|---|
| Read feed, posts, profiles, communities | Yes | Yes | Yes | Yes | Yes | Yes |
| Create General / Doubt / Request / Lost / Found | Yes | Yes | Yes | Yes | Yes | Yes |
| Comment, vote, DM | Yes | Yes | Yes | Yes | Yes | Yes |
| Campus-wide announcement | No | No | Yes | No | No | Yes |
| Announcement inside a community | No | No | Yes (if member) | Yes (own community) | Yes (own community) | Yes |
| Create event | No | No | Yes | Yes (own community) | Yes (own community) | Yes |
| Pin post | No | No | Own campus-wide announcements | Own community | Own community | Anywhere |
| Remove others' content | No | No | No | Own community | Own community | Anywhere |
| Create community directly | No (request only) | No (request only) | Yes | n/a | n/a | Yes |
| Promote moderators | No | No | No | No | Own community | Anywhere |
| Approve teachers, handle reports, suspend users | No | No | No | No | No | Yes |

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Feed first page loads in under 1.5 s on campus Wi-Fi; API p95 under 300 ms for reads with 5,000 users and 50,000 posts |
| Real-time | DM delivery under 1 s end-to-end |
| Availability | 99% during semester hours for the pilot; single server is acceptable |
| Security | Passwords hashed with bcrypt; JWT in httpOnly cookie; rate-limited auth; uploads validated; no secrets in the client |
| Privacy | No phone numbers; enrollment number private; DMs private; data stays on college-controlled hosting |
| Accessibility | WCAG 2.1 AA contrast, full keyboard navigation, alt text on images |
| Devices | Works on Chrome, Edge, Firefox, Safari (last 2 versions), Android Chrome, iOS Safari; 360 px to 1920 px wide |
| Scalability path | SQLite for MVP; schema is portable to PostgreSQL; local uploads replaceable by object storage |
| Data retention | Deleted posts and comments are soft-deleted for 30 days for moderation, then purged |

---

## 9. Success Metrics (first 60 days of pilot)

| Metric | Target |
|---|---|
| Registered users as percentage of a pilot batch | 60% |
| Weekly active users / registered users | 40% |
| Median time to first answer on doubts | under 2 hours |
| Doubts with an accepted answer | 50% |
| Lost/found posts resolved | 30% |
| Requests fulfilled | 50% |
| Average RSVPs per club event | 3x the club's member count |
| Faculty profiles with cabin filled | 100% of registered faculty |
| Reports resolved within 24 hours | 90% |

---

## 10. Assumptions and Dependencies

1. Every student and teacher has an active `@dypiu.ac.in` mailbox and can receive OTP emails.
2. The college allows a pilot and can provide (or allow collection of) department and faculty lists.
3. An SMTP account (college mail relay or a transactional service) is available for production OTPs.
4. Hosting is a single small server or PaaS instance with persistent disk.

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Spam or abusive posts | Loss of trust | Verified emails, reporting, auto-hide threshold, suspensions, rate limits (10 posts per hour per user) |
| Someone registers as "Teacher" falsely | Fake announcements | Teacher accounts start pending; admin approval required for announcement rights |
| Cold start (empty feed) | Low adoption | Seed official communities, onboard 2 to 3 clubs and 5 faculty before launch, launch with a real event |
| Notification fatigue from announcements | Users ignore the app | Campus-wide announcements limited to verified faculty and admins; community notifications only for members |
| OTP emails land in spam | Users cannot register | Use the college relay; show "Check spam" hint; resend after 60 s |
| Inappropriate images | Harm, reputational risk | Report + quick removal; image size limits; MVP has no automatic image moderation, flagged as P2 |
| SQLite limits under heavy load | Slowness | WAL mode, indexes, migration plan to PostgreSQL documented in TRD |

## 12. Release Plan

| Phase | Content |
|---|---|
| MVP (hackathon demo) | All P0 features, seeded demo data, local or single-server deployment |
| Pilot (one department, 4 weeks) | P1 features, real SMTP, admin onboarding, feedback form |
| Campus launch | P2 features as prioritized by pilot feedback, PWA, email digest |

## 13. Glossary

| Term | Meaning |
|---|---|
| Campus-wide post | A post that does not belong to any community and is shown to everyone |
| Community | A group (club, department, batch, interest, official) with its own feed and members |
| Verified teacher | A teacher account approved by a platform admin |
| Resolved | A doubt with an accepted answer, a request fulfilled, or a lost/found item returned |
| RSVP | A user's response to an event: Going or Interested |
| OTP | One-time password sent to the email to prove ownership |
