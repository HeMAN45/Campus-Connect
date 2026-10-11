# 07. Dataset Guide

**Product:** Campus Connect
**Version:** 1.0 (MVP)
**Related:** [05-BACKEND-SCHEMA.md](05-BACKEND-SCHEMA.md), [06-IMPLEMENTATION-PLAN.md](06-IMPLEMENTATION-PLAN.md)
**Last updated:** 2026-10-11

---

## 0. What Is Built in the MVP

| Item | Status |
|---|---|
| Reference data (`seed/reference/*.json`) | Built, loaded by the server at startup and by the seeder |
| Demo data (`seed/demo/*.json`) and loader (`npm run seed`) | Built: 46 users, about 40 communities including auto-created batches, 38 posts, 25 comments, 155 RSVPs, 4 conversations |
| Generated filler users | Built. Keys follow `g-<dept>-<year>-01`, for example `g-cse-2-01` |
| Demo images folder | Not shipped. The loader has no image step yet; avatars fall back to initials, and images are added live during the demo |
| `seed:validate`, `seed:purge-demo`, pilot `faculty.csv` import | Not built yet (P1). The seeder refuses to run on a database that already holds non-demo accounts |
| Test fixtures | Built inline in `server/test/api.test.js` (in-memory database) |

Field names in the shipped JSON differ slightly from the examples below: mentoring is a `"mentor": ["Placements", ...]` array on the user, and a post can target a batch with `"community": "batch:AIML:3"` (department code and year of study).

## 1. Purpose

Campus Connect has no machine learning model, so "dataset" here means the **seed and reference data** that make the app usable and demoable:

1. **Reference data** that must exist before anyone registers: departments, programs, designations, subject tags, official communities.
2. **Directory data** for the pilot: the real faculty list with cabins and office hours (collected with permission).
3. **Demo data** for the hackathon: fictional users, communities, posts, comments, events, and conversations that tell the demo story.
4. **Test fixtures** for automated tests: a minimal, deterministic subset.

This guide defines the file formats, rules for collecting real data, privacy constraints, how to load everything, and how to validate it.

---

## 2. Folder Layout

```
server\seed\
|-- reference\
|   |-- departments.json
|   |-- programs.json
|   |-- designations.json
|   |-- subject-tags.json
|   |-- mentor-topics.json
|-- demo\
|   |-- users.json
|   |-- communities.json
|   |-- memberships.json
|   |-- posts.json
|   |-- comments.json
|   |-- rsvps.json
|   |-- conversations.json
|   |-- images\              Demo images (posters, lost items, doubt screenshots, avatars)
|-- pilot\
|   |-- faculty.csv          Real faculty directory (NOT committed, see section 6)
|-- fixtures\
|   |-- test-minimal.json    Used by automated tests
|-- seed.js                  Loader
|-- validate.js              Validator (run before seed)
```

Seed commands (PowerShell, from `C:\DH\server`):

```powershell
npm run db:reset
npm run seed            # reference + demo
npm run seed -- --only=reference
npm run seed -- --pilot=seed\pilot\faculty.csv
```

`seed.js` is idempotent for reference data (upsert by `code` / `slug` / `email`) and refuses to load demo data into a database that already has non-demo users, to avoid mixing fake and real content.

---

## 3. Reference Data

### 3.1 `departments.json`

```json
[
  { "code": "CSE",  "name": "Computer Science and Engineering", "school": "School of Computer Science and Engineering" },
  { "code": "AIML", "name": "Artificial Intelligence and Machine Learning", "school": "School of Computer Science and Engineering" },
  { "code": "DS",   "name": "Data Science", "school": "School of Computer Science and Engineering" },
  { "code": "IT",   "name": "Information Technology", "school": "School of Computer Science and Engineering" },
  { "code": "ENTC", "name": "Electronics and Telecommunication", "school": "School of Engineering" },
  { "code": "MECH", "name": "Mechanical Engineering", "school": "School of Engineering" },
  { "code": "CIVIL","name": "Civil Engineering", "school": "School of Engineering" },
  { "code": "BCA",  "name": "Computer Applications", "school": "School of Computer Applications" },
  { "code": "MGMT", "name": "Management", "school": "School of Management" },
  { "code": "DES",  "name": "Design", "school": "School of Design" }
]
```

These are placeholders. Before the pilot, replace them with the university's official department list. Rules: `code` is 2 to 12 uppercase letters, unique, and never changes once users exist (it is used in batch community slugs).

### 3.2 `programs.json`

```json
[
  { "code": "BTECH", "name": "B.Tech", "years": 4 },
  { "code": "MTECH", "name": "M.Tech", "years": 2 },
  { "code": "BCA",   "name": "BCA",    "years": 3 },
  { "code": "MCA",   "name": "MCA",    "years": 2 },
  { "code": "BBA",   "name": "BBA",    "years": 3 },
  { "code": "MBA",   "name": "MBA",    "years": 2 },
  { "code": "BDES",  "name": "B.Des",  "years": 4 },
  { "code": "PHD",   "name": "Ph.D",   "years": 5 }
]
```

`years` drives the Year select and the graduation year calculation.

### 3.3 `designations.json`

```json
["Professor", "Associate Professor", "Assistant Professor", "Head of Department", "Dean", "Lab Assistant", "Visiting Faculty", "Teaching Assistant", "Staff"]
```

### 3.4 `subject-tags.json`

Suggested tags for Doubt posts, keyed by department code. Users can still type a custom tag.

```json
{
  "_common": ["Maths", "Physics", "Communication Skills", "Environmental Studies"],
  "CSE":  ["DSA", "DBMS", "OS", "CN", "TOC", "Compiler Design", "OOP", "Java", "Python", "Web Dev"],
  "AIML": ["DSA", "DBMS", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Probability", "Linear Algebra", "Python"],
  "DS":   ["Statistics", "Machine Learning", "Big Data", "SQL", "Data Visualization", "Python"],
  "ENTC": ["Signals and Systems", "Digital Electronics", "Microprocessors", "VLSI", "Communication Systems"],
  "MECH": ["Thermodynamics", "Fluid Mechanics", "SOM", "Machine Design", "Manufacturing"],
  "BCA":  ["C Programming", "Java", "DBMS", "Web Dev", "Networking"],
  "MGMT": ["Marketing", "Finance", "HR", "Economics", "Business Analytics"]
}
```

### 3.5 `mentor-topics.json`

```json
["Electives", "Internships", "Placements", "Clubs", "Competitive programming", "Research", "Hackathons", "Higher studies", "Hostel life"]
```

### 3.6 Official communities (in `demo/communities.json` with `"type": "official"`)

| Slug | Name | Auto-join | Who posts |
|---|---|---|---|
| `dypiu` | DYPIU Announcements | Yes | Admins and verified faculty |
| `placements` | Placement Cell | Yes | Admins and assigned moderators |
| `help` | Campus Connect Help | Yes | Admins (how-to posts, feedback) |

Department and batch communities are created automatically by `seed.js` from `departments.json` (one `department` community per code; batch communities are created on demand when the first student of that batch registers).

---

## 4. Demo Data

### 4.1 Volume targets

| Entity | Count | Why |
|---|---|---|
| Users | 40 (28 students across years 1 to 4, 9 faculty, 2 club-lead students counted in students, 1 admin, 2 pending faculty) | Directory looks real, filters return results |
| Communities | 14 (3 official, 6 department, 2 batch, 3 clubs) | All types visible |
| Posts | 70 (10 doubts, 8 requests, 6 lost, 4 found, 8 announcements, 8 events, 26 general) | Every tab has content |
| Comments | 180 (20 with images) | Threads look alive |
| Events | 8 (5 upcoming spread over the next 3 weeks, 3 past) | Rail and Past events both populated |
| RSVPs | 250 | Realistic counts |
| Conversations | 6 (with 60 messages, 8 images) | Messages page is not empty for demo accounts |

### 4.2 Demo accounts

All demo accounts share one local-only password defined in `server/.env` as `SEED_PASSWORD` (the example file uses a placeholder). They are created with `status = active` and skip OTP.

| Persona | Email | Role | Department / Year | Notes |
|---|---|---|---|---|
| Aarav Mehta | `demo.aarav@dypiu.ac.in` | Student | AIML, 1st year | Main demo user |
| Sneha Patil | `demo.sneha@dypiu.ac.in` | Student | CSE, 3rd year | GDGC community admin, open to mentor |
| Rohan Deshmukh | `demo.rohan@dypiu.ac.in` | Student | AIML, 4th year | Open to mentor (Placements, Internships) |
| Riya Kulkarni | `demo.riya@dypiu.ac.in` | Student | DS, 2nd year | Has a lost ID card post |
| Prof. Rahul Kulkarni | `demo.rkulkarni@dypiu.ac.in` | Teacher (verified) | AIML, Assistant Professor | Cabin "Block A, Room 304", teaches Deep Learning (3rd year) |
| Dr. Meera Iyer | `demo.miyer@dypiu.ac.in` | Teacher (verified) | CSE, Associate Professor | Cabin "Block B, Room 212", teaches DBMS (2nd year) |
| Prof. Anil Joshi | `demo.ajoshi@dypiu.ac.in` | Teacher (pending) | MECH | Shows in admin pending list |
| Admin | `demo.admin@dypiu.ac.in` | Admin | | Admin dashboard |

All names are fictional. The `demo.` prefix makes demo accounts easy to find and purge (`DELETE FROM users WHERE email LIKE 'demo.%'` cascades to their content).

### 4.3 `users.json` format

```json
[
  {
    "key": "aarav",
    "email": "demo.aarav@dypiu.ac.in",
    "name": "Aarav Mehta",
    "role": "student",
    "status": "active",
    "department": "AIML",
    "program": "BTECH",
    "year": 1,
    "section": "B",
    "bio": "First year, into robotics and Python.",
    "skills": ["Python", "Arduino"],
    "avatar": "images/avatars/aarav.webp"
  },
  {
    "key": "rkulkarni",
    "email": "demo.rkulkarni@dypiu.ac.in",
    "name": "Prof. Rahul Kulkarni",
    "role": "teacher",
    "status": "active",
    "department": "AIML",
    "designation": "Assistant Professor",
    "officeLocation": "Block A, Room 304",
    "officeHours": "Mon, Wed 2:00 to 4:00 PM",
    "subjects": [{ "name": "Deep Learning", "year": 3 }, { "name": "Machine Learning", "year": 2 }],
    "bio": "Research in computer vision. Happy to discuss projects during office hours."
  }
]
```

- `key` is a stable handle used by other seed files instead of numeric ids.
- `department` and `program` use codes from reference files.
- `avatar` is optional; when missing, the UI shows initials.

### 4.4 `communities.json` format

```json
[
  {
    "slug": "gdgc",
    "name": "GDGC DYPIU",
    "type": "club",
    "description": "Google Developer Groups on Campus. Workshops, study jams, and hackathons.",
    "rules": "Be kind. No spam. Event posts by club leads only.",
    "avatar": "images/communities/gdgc-avatar.webp",
    "cover": "images/communities/gdgc-cover.webp",
    "createdBy": "sneha",
    "admins": ["sneha"],
    "moderators": []
  }
]
```

Club names are illustrative. If you use a real club's name or logo in a public demo, get the club's permission first.

### 4.5 `memberships.json` format

```json
[
  { "community": "gdgc", "users": ["sneha", "rohan", "u-cse-3-04", "u-cse-3-07"] },
  { "community": "robotics", "users": ["aarav", "u-mech-2-01"] }
]
```

Department, batch, and official memberships are created automatically from user data, so they do not appear here.

### 4.6 `posts.json` format

Times are relative to the moment the seed runs, so the demo always looks fresh. `"ago": "2h"` means created 2 hours before seeding; `"in": "7d 15:00"` means 7 days from today at 15:00 IST.

```json
[
  {
    "key": "gdgc-workshop",
    "type": "event",
    "author": "sneha",
    "community": "gdgc",
    "title": "Build with AI: hands-on workshop",
    "body": "Bring your laptop. We will build a small app using a public AI API. Beginners welcome.",
    "event": { "startsIn": "7d 15:00", "durationMinutes": 180, "venue": "Seminar Hall, Block A", "url": null },
    "images": [{ "file": "images/posts/gdgc-poster.webp", "alt": "Workshop poster with date and venue" }],
    "ago": "2h"
  },
  {
    "key": "doubt-3nf",
    "type": "doubt",
    "author": "aarav",
    "community": "aiml",
    "subjectTag": "DBMS",
    "title": "Why is 3NF not always dependency preserving?",
    "body": "In the example from class (attached), decomposing R(A,B,C,D) loses B -> C. What am I missing?",
    "images": [{ "file": "images/posts/3nf-example.webp", "alt": "Handwritten relation and functional dependencies" }],
    "ago": "40m"
  },
  {
    "key": "req-calculator",
    "type": "request",
    "author": "aarav",
    "community": null,
    "title": "Need a scientific calculator for the 2 PM exam, Block B",
    "body": "Mine stopped working. Will return right after the exam.",
    "neededIn": "3h",
    "ago": "10m"
  },
  {
    "key": "lost-id",
    "type": "lost",
    "author": "riya",
    "community": null,
    "title": "Blue ID card holder with college ID",
    "body": "Lost near the canteen counter around lunch. Has a metro card too.",
    "item": { "location": "Canteen, Block C", "daysAgo": 0 },
    "ago": "3h"
  },
  {
    "key": "ann-dl-lab",
    "type": "announcement",
    "author": "rkulkarni",
    "community": null,
    "title": "Deep Learning lab moved to Lab 3, Block A this Friday",
    "body": "Third-year AIML students: Friday's lab is in Lab 3 because of maintenance in Lab 1.",
    "pinned": true,
    "ago": "1d"
  }
]
```

Optional fields per post: `status` (`"resolved"`), `acceptedComment` (a comment key), `score` (target score; the loader creates votes from random seeded users to reach it), `commentsLocked`.

### 4.7 `comments.json` format

```json
[
  {
    "key": "c-3nf-prof",
    "post": "doubt-3nf",
    "author": "rkulkarni",
    "body": "Good question. 3NF synthesis guarantees dependency preservation, but your decomposition came from BCNF steps. See the attached worked example.",
    "image": { "file": "images/comments/3nf-answer.webp", "alt": "Worked 3NF synthesis on whiteboard" },
    "ago": "25m",
    "score": 9
  },
  {
    "key": "c-3nf-reply",
    "post": "doubt-3nf",
    "parent": "c-3nf-prof",
    "author": "aarav",
    "body": "That makes sense now, thank you!",
    "ago": "20m"
  }
]
```

### 4.8 `rsvps.json` format

```json
[
  { "post": "gdgc-workshop", "going": 86, "interested": 40, "include": ["rohan", "riya"] }
]
```

The loader picks random seeded users (deterministic seed) to reach the counts, always including the listed keys. Aarav is intentionally not included so the demo can show him RSVPing live.

### 4.9 `conversations.json` format

```json
[
  {
    "between": ["aarav", "rohan"],
    "messages": [
      { "from": "aarav", "body": "Hi Rohan, I saw you're open to mentor. Which electives did you take in 3rd year?", "ago": "2d" },
      { "from": "rohan", "body": "Hey! I took NLP and Computer Vision. Here's the list I used.", "ago": "2d" },
      { "from": "rohan", "image": "images/messages/electives-list.webp", "ago": "2d" }
    ],
    "readUpTo": "all"
  }
]
```

### 4.10 Generated filler users

To reach 40 users without writing every record, `users.json` can include a generator block:

```json
{ "generate": { "count": 24, "prefix": "u", "departments": ["CSE", "AIML", "DS", "ENTC", "MECH", "BCA"], "years": [1, 2, 3, 4], "mentorShare": 0.3, "seed": 2026 } }
```

Generated users get keys like `u-cse-3-04`, emails like `demo.u-cse-3-04@dypiu.ac.in`, names from a fixed list of common Indian first and last names in `seed/names.json`, and deterministic skills. The fixed random seed means everyone on the team gets the same data.

---

## 5. Images

| Kind | Size and format | Count | Source rules |
|---|---|---|---|
| Avatars | 256 x 256 WebP, under 40 KB | About 12 (others use initials) | Generated abstract avatars or photos of team members with consent. No photos of real students or faculty without written consent |
| Community avatars | 256 x 256 WebP | 14 | Simple text marks made by the team; real club logos only with permission |
| Community covers | 1200 x 320 WebP, under 120 KB | 6 | Own campus photos or plain color blocks |
| Event posters | 1080 x 1350 WebP, under 250 KB | 8 | Made by the team in a design tool |
| Lost/found items | 1200 x 900 WebP | 10 | Photos of team members' own items |
| Doubt screenshots | Up to 1600 px wide | 8 | Own handwritten notes or self-made diagrams; no copyrighted textbook pages |
| Message images | Up to 1200 px | 8 | Same rules |

Never use images copied from the internet unless the license explicitly allows reuse and the attribution is recorded in `seed/demo/images/CREDITS.md`.

---

## 6. Real Pilot Data: Faculty Directory

The directory is only valuable if faculty cabins and office hours are accurate. For the pilot:

### 6.1 Collection

1. Ask the department office (HOD or coordinator) for the official faculty list with cabin numbers. Explain the purpose and that faculty can edit or hide their details.
2. Or let faculty fill their own details on first login (the register form already asks for designation and cabin). This is the preferred long-term source.
3. Do not scrape the university website or any portal.

### 6.2 `faculty.csv` format

```csv
email,name,department_code,designation,office_location,office_hours,subjects
r.kulkarni@dypiu.ac.in,Rahul Kulkarni,AIML,Assistant Professor,"Block A, Room 304","Mon, Wed 2:00 to 4:00 PM","Deep Learning:3;Machine Learning:2"
```

- `subjects` is `name:year` pairs separated by `;`.
- Importing a faculty row does **not** create a login. It creates a "directory-only" placeholder (`status = pending`, random unusable password hash). When that faculty member registers with the same email through OTP, the account is claimed: the password is set, details are kept, and status becomes `active` (pre-verified, because the list came from the department).
- The CSV contains personal data. Keep it out of git (`server/seed/pilot/` is in `.gitignore`) and delete local copies after import.

### 6.3 Student data

Do not import any student list. Students create their own accounts. Never collect enrollment numbers in bulk.

---

## 7. Privacy and Ethics Rules

| Rule | Detail |
|---|---|
| Fictional demo data | All demo names, emails, and content are invented. The `demo.` email prefix is reserved for this |
| Consent for real data | Faculty data only from the department or the faculty member; real photos only with consent |
| Minimization | No phone numbers, home addresses, dates of birth, or ID numbers anywhere in seed data |
| Lost and found | Demo lost items must not show real ID numbers or faces |
| Separation | The loader refuses to mix demo and real users; production deployments never run the demo seed |
| Removal | `npm run seed:purge-demo` deletes all `demo.%` users and their content |

---

## 8. Validation

`npm run seed:validate` (runs automatically before `npm run seed`) checks:

1. Every JSON file parses and matches its zod schema (same schemas as the API where possible).
2. All `key` references resolve (authors, communities, posts, parents, conversation members).
3. Department, program, designation, and subject values exist in reference files.
4. Event posts have a community, a future or past start as intended, and a venue.
5. Lost/found posts have location and date; doubts have a subject tag.
6. Every image file referenced exists, is under the upload size limit, and is one of the allowed types.
7. All emails end with the configured `ALLOWED_EMAIL_DOMAIN`.
8. No field matches a phone number pattern (`\b[6-9]\d{9}\b`) or a 12-digit ID pattern.

The command prints a summary (counts per entity) and exits non-zero on any error.

After seeding, `npm run db:check` (P1) verifies denormalized counters against real counts (see schema doc section 7).

---

## 9. Test Fixtures

`fixtures/test-minimal.json` contains exactly:

| Entity | Records |
|---|---|
| Departments | `CSE`, `AIML` |
| Users | 1 student year 1, 1 student year 3 (mentor), 1 verified teacher, 1 pending teacher, 1 admin, 1 suspended student |
| Communities | 1 official, 1 club with the year-3 student as admin |
| Posts | One of each type |
| Conversations | 1 between the two students |

Tests load it into an in-memory database (`DB_PATH=:memory:`) before each test file, so tests are fast and independent.
