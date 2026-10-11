# 04. UI/UX Brief

**Product:** Campus Connect
**Version:** 1.0 (MVP)
**Related:** [03-APP-FLOW.md](03-APP-FLOW.md), [01-PRD.md](01-PRD.md)
**Last updated:** 2026-10-11

---

## 1. Design Direction

**One line:** a calm, well-organized campus notice board that happens to be live.

Campus Connect will be opened between classes, on a phone, in a hurry. The interface must make it obvious in one glance what kind of post something is (doubt, event, lost item), who posted it (student, faculty, club), and what to do next (answer, RSVP, message). It should feel like a serious tool for a university, not a toy and not a nightclub.

### 1.1 Principles

| # | Principle | In practice |
|---|---|---|
| 1 | **Type first** | The post type label and its color are the first thing the eye lands on in every card |
| 2 | **Big, readable text** | Body text is 16 px minimum, titles 19 to 20 px, generous line height; nothing important below 13 px |
| 3 | **Flat and sharp** | Borders, not shadows. Corner radius 4 px on cards, 2 px on chips. No gradients, no glows, no glass effects |
| 4 | **Not black** | Dark text is graphite `#1E2227`, dark mode background is graphite `#1B1F24`, never pure `#000` |
| 5 | **One accent** | A single deep blue accent for primary actions and links; type colors are muted and only used for labels |
| 6 | **Trust is visible** | Faculty, verified, club admin, and "Open to mentor" badges are consistent everywhere a name appears |
| 7 | **Every empty screen suggests a next step** | No blank pages |
| 8 | **Fast feel** | Optimistic updates for votes, RSVPs, and messages; skeletons instead of spinners |

### 1.2 What we avoid

- Gradients, neon, glows, glassmorphism, heavy drop shadows
- Pure black backgrounds or text
- Emoji in UI labels or system copy (users can type emoji in their own posts)
- Pill-shaped everything; rounded corners above 6 px except avatars
- Tiny gray text for important information (cabin numbers, event times)
- Icon-only buttons without labels or tooltips on desktop
- Infinite modal stacks; at most one modal at a time

---

## 2. Design Tokens

These map directly to `client/tailwind.config.js` under `theme.extend`.

### 2.1 Color: light theme (default)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F3F3EF` | App background (warm paper) |
| `surface` | `#FFFFFF` | Cards, panels, inputs |
| `surface-2` | `#F8F8F5` | Hover rows, nested comments, input background |
| `border` | `#DCDCD5` | Card and input borders, dividers |
| `border-strong` | `#B9B9B0` | Focused inputs, active tab underline base |
| `ink` | `#1E2227` | Primary text |
| `ink-2` | `#4A5058` | Secondary text (metadata) |
| `ink-3` | `#6E747C` | Placeholder, disabled (still 4.5:1 on white) |
| `accent` | `#1F4E8C` | Primary buttons, links, active nav, focus ring |
| `accent-hover` | `#183F72` | Primary hover |
| `accent-soft` | `#E6EDF6` | Selected chip background, active nav background |
| `success` | `#2F6B3F` | Resolved, accepted answer, Found |
| `warning` | `#8A5A00` | Request, expiring |
| `danger` | `#A23B32` | Lost, destructive actions, errors |

### 2.2 Color: dark theme (P1)

| Token | Hex |
|---|---|
| `bg` | `#1B1F24` |
| `surface` | `#23282E` |
| `surface-2` | `#2A3037` |
| `border` | `#363C44` |
| `ink` | `#E8E9E6` |
| `ink-2` | `#B4B8BD` |
| `ink-3` | `#8C9197` |
| `accent` | `#7FA6DA` |
| `accent-soft` | `#26364A` |

### 2.3 Post type labels

Each label is an uppercase, 12 px, semibold, letter-spaced tag with a 1 px border in the type color, text in the type color, and a very light tint background. The same color is used for a 3 px left border on the card.

| Type | Label text | Color | Tint background | Icon (lucide) |
|---|---|---|---|---|
| General | POST | `#4A5058` | `#F1F1EE` | `MessageSquare` |
| Doubt | DOUBT | `#1F4E8C` | `#E6EDF6` | `HelpCircle` |
| Request | REQUEST | `#8A5A00` | `#F7EFDD` | `HandHelping` |
| Lost | LOST | `#A23B32` | `#F6E5E3` | `SearchX` |
| Found | FOUND | `#2F6B3F` | `#E3EFE6` | `PackageCheck` |
| Announcement | ANNOUNCEMENT | `#1E2227` | `#ECECE7` | `Megaphone` |
| Event | EVENT | `#5B3F8C` | `#ECE6F4` | `CalendarDays` |

Status tags use the same style: ANSWERED (success), FULFILLED (success), RESOLVED (success), EXPIRED (ink-3), PINNED (ink with `Pin` icon).

### 2.4 Typography

Font: **Inter**, self-hosted via `@fontsource/inter` (weights 400, 500, 600, 700). Numbers use `font-variant-numeric: tabular-nums` in counts and times.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 32 / 40 | 700 | Auth screen headings |
| `h1` | 26 / 34 | 700 | Page titles (Directory, Messages) |
| `h2` | 20 / 28 | 600 | Post titles on detail, profile name |
| `title` | 19 / 26 | 600 | Post titles in feed cards |
| `body` | 16 / 26 | 400 | Post body, comments, messages |
| `ui` | 15 / 22 | 500 | Buttons, nav items, inputs |
| `meta` | 14 / 20 | 400 | Author line, timestamps, counts |
| `label` | 12 / 16 | 600, uppercase, 0.06em tracking | Type tags, section labels |

On mobile, `display` drops to 28 and `h1` to 22; body stays 16.

### 2.5 Spacing, radius, borders

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Card padding 20 desktop, 16 mobile. Gap between feed cards 12.
- Radius: cards 4, inputs and buttons 4, chips and tags 2, avatars full circle, images inside cards 2.
- Borders: 1 px `border` everywhere. Focus: 2 px `accent` outline with 2 px offset.
- Elevation: none in content. Only floating layers (dropdowns, modals, toasts) get a single subtle shadow `0 4px 16px rgba(30,34,39,0.12)` so they separate from content.

### 2.6 Motion

- Durations 120 ms (hover, press), 180 ms (dropdowns, tabs), 240 ms (modals).
- Easing `cubic-bezier(0.2, 0, 0, 1)`.
- No bouncing, no parallax. Respect `prefers-reduced-motion`: disable all non-essential transitions.

---

## 3. Layout

### 3.1 Desktop (1280 px reference)

```
+--------------------------------------------------------------------------------------+
| [CC] Campus Connect   [ Search posts, people, communities...        ]  [+ New post] (bell) (avatar) |
+----------------+-------------------------------------------+-------------------------+
| Home           |  All  Announcements  Events  Doubts       | UPCOMING EVENTS         |
| Communities    |  Requests  Lost & Found       Sort: Hot v | 18 OCT  GDGC Build with |
| Directory      |-------------------------------------------|         AI Workshop     |
| Messages    3  | PINNED  ANNOUNCEMENT                      |         Seminar Hall A  |
| Notifications  | Mid-sem exam timetable published          | 21 OCT  Robotics Expo   |
| Profile        |-------------------------------------------|-------------------------|
|                | | EVENT  GDGC DYPIU . 2h                  | PINNED                  |
| ---            | | GDGC Build with AI Workshop             | Library hours extended  |
| YOUR COMMUNITIES| | Sat 18 Oct . 3:00 to 6:00 PM . Sem Hall| ------------------------|
| AIML           | | [poster image]                          | YOUR COMMUNITIES        |
| AIML 2024      | | ^ 31 v   12 comments   [Going] 86 going  | AIML . GDGC . CP Club   |
| GDGC DYPIU     |-------------------------------------------|                         |
|                | | DOUBT  DBMS . Aarav M. . 20m            |                         |
|                | | Why is 3NF not always dependency...     |                         |
+----------------+-------------------------------------------+-------------------------+
   240 px                    flexible, max 680 px                    320 px
```

- Max content width 1280 px, centered. Sidebar 240, rail 320, gutters 24.
- The left sidebar and right rail are sticky; the center column scrolls.

### 3.2 Tablet (768 to 1023 px)

Sidebar collapses to a 72 px icon column with tooltips. The rail is hidden; "Upcoming events" becomes a horizontal scroll strip at the top of Home.

### 3.3 Mobile (360 to 767 px)

```
+------------------------------+
| [CC]  Campus Connect  (s)(b) |
+------------------------------+
| UPCOMING  [18 OCT GDGC...] > |
| All  Events  Doubts  Req...> |
|------------------------------|
| EVENT  GDGC DYPIU . 2h       |
| GDGC Build with AI Workshop  |
| Sat 18 Oct . 3 PM . Sem Hall |
| [poster]                     |
| ^31v  12  [Going]            |
|------------------------------|
| ...                          |
+------------------------------+
| Home  Comm  [+]  Msg  Dir    |
+------------------------------+
```

- Bottom tab bar 56 px tall, labels under icons, center "+" opens the composer full screen.
- Cards go edge to edge with only top and bottom borders (no side borders) to use the full width.
- Touch targets at least 44 x 44 px.

---

## 4. Components

### 4.1 Buttons

| Variant | Style | Use |
|---|---|---|
| Primary | `accent` background, white text, 40 px height, 16 px horizontal padding | One per view: Post, Send code, Create account, Save |
| Secondary | White background, `border`, `ink` text | Cancel, Join, Message |
| Ghost | No border, `ink-2` text, `surface-2` on hover | Toolbar actions (Reply, Share) |
| Danger | `danger` text and border; filled on confirm dialogs | Delete, Remove, Suspend |
| Toggle (RSVP, Join) | Secondary when off; `accent-soft` background with `accent` text and a check icon when on | Going, Interested, Joined |

Disabled buttons use `ink-3` text and `surface-2` background and always have a tooltip or helper text explaining why.

### 4.2 Inputs

- 44 px height, 1 px `border`, 4 px radius, `surface` background, 15 px text.
- Label above (14 px, 500), helper text below (14 px, `ink-2`), error text below in `danger` with an `AlertCircle` icon, and the border turns `danger`.
- Text areas auto-grow up to 12 lines, then scroll.
- The OTP input is six 52 x 56 px boxes, 24 px digits, tabular numbers.

### 4.3 Post card (feed)

```
| [3px type color bar]
| LABEL  Community name . Author name [badge] . 2h
| Title in 19 px semibold, up to 2 lines
| Body preview, 16 px, up to 3 lines, fades at the end
| [type strip: event date/venue, or lost location/date, or needed-by]
| [image: first image, 16:9 crop, max 360 px tall; "+2" overlay if more]
| ^ 31 v     12 comments     [type action]                  ...
```

- Type action: Doubt -> "Answer"; Request -> "Offer help"; Lost/Found -> "Message"; Event -> "Going" toggle.
- The whole card is clickable to open the detail, except interactive controls.
- Resolved cards: label row shows the status tag; body text in `ink-2`.

### 4.4 Event date block

A 56 x 64 px box with a 1 px `border`: month in `label` style (OCT) on top, day number 24 px bold below. Used in event cards, the rail, and community Events tabs.

### 4.5 Author line and badges

`Avatar (24 px) Name  [BADGE]  . Community . 2h`

| Badge | Look | Shown when |
|---|---|---|
| FACULTY | `ink` border and text | Teacher (pending or verified) |
| VERIFIED | Small `BadgeCheck` icon in `accent` right after the name | Verified teacher |
| CLUB ADMIN / MOD | `label` tag in event purple | Author is admin/moderator of the post's community |
| MENTOR | `label` tag in success green | Open to mentor |
| YEAR | "3rd yr" in `meta` | Students, after the name on profile and directory cards |

### 4.6 Comments

- Avatar 32 px, author line, body 16 px, optional image (max 320 px wide, 2 px radius, click for lightbox), then actions: vote, Reply, "..." (Report, Delete if own).
- Replies indent 40 px with a 1 px left guide line in `border`.
- Accepted answer: full-width block right after the post with a 3 px `success` left border and a "ACCEPTED ANSWER" label.

### 4.7 Image picker and preview

- Trigger: `ImagePlus` icon button with tooltip "Add image".
- After choosing: thumbnail 72 x 72 px with an "x" remove button, filename truncated, size; below it an optional "Alt text" input.
- Posts: up to 4 thumbnails in a row, drag to reorder (P1).
- Errors appear under the picker in `danger` text.
- Paste from clipboard and drag-and-drop onto the composer also attach images.

### 4.8 Lightbox

Full-screen overlay `rgba(27,31,36,0.92)`, image centered at max 92 vw / 88 vh, close button top right (44 px), left/right arrows for multi-image posts, Esc closes, focus is trapped, alt text shown as a caption.

### 4.9 Message bubbles

- Own messages: right aligned, `accent-soft` background, `ink` text. Others: left aligned, `surface` with `border`.
- Radius 4 px. Max width 72% of the pane. Body 16 px.
- Time and status ("Sending", "Sent", "Seen", "Not sent. Retry") in `meta` below the last bubble of a group.
- Messages from the same sender within 5 minutes are grouped; a date divider separates days ("Today", "Yesterday", "Sat 11 Oct").

### 4.10 Tabs and chips

- Page tabs: text tabs with a 2 px `accent` underline on the active tab, `ink-2` text otherwise.
- Filter chips: 32 px tall, 2 px radius, `border`; selected uses `accent-soft` background and `accent` text.

### 4.11 Toasts

Bottom center on mobile, bottom left on desktop, `ink` background with white text (the one dark element), 4 s, with an optional action ("Undo", "Retry"). Max 3 stacked.

### 4.12 Modals

Max width 560 px, 4 px radius, title 20 px, close icon, primary action bottom right. Confirm dialogs name the action in the button ("Delete post", not "OK").

### 4.13 Skeletons

Gray blocks in `surface-2` matching card layout. A slow 1.2 s opacity pulse, disabled with reduced motion.

### 4.14 Empty states

Centered in the content area: a 40 px line icon in `ink-3`, a one-line heading (h2 size 18), one sentence, one button. Example: Messages empty -> `MessagesSquare` icon, "No messages yet", "Find a classmate, senior, or faculty member in the Directory.", button "Open Directory".

---

## 5. Screen Briefs

### 5.1 Auth screens (Login, Register x3)

```
+---------------------------------------------+
|                                             |
|   Campus Connect                            |
|   Everything happening at DYPIU,            |
|   in one place.                             |
|                                             |
|   College email                             |
|   [ yourname@dypiu.ac.in              ]     |
|   Only dypiu.ac.in emails can join.         |
|                                             |
|   [        Send code          ]             |
|                                             |
|   Already have an account? Log in           |
+---------------------------------------------+
```

- Centered single column, max width 420 px, on `bg`. Desktop shows a left panel (40% width, `surface` with a border) listing the three things the app does: "Ask and answer doubts", "Never miss a club event", "Find any faculty cabin".
- Registration shows a 3-step indicator ("1 Email  2 Verify  3 Profile").

### 5.2 Home

See layout in section 3. Additions:
- Welcome card for new users (dismissible) at the top of the feed.
- Pending faculty banner: `warning` left border, "Your faculty account is waiting for verification. You can comment and message now; announcements unlock after approval."

### 5.3 Post detail

- Back link "Back to feed".
- Full post: type label, author line with badges, h2 title, full body, image grid (1 image full width; 2 side by side; 3 as one large + two small; 4 as 2x2), type panel (event panel with date block, time, venue, RSVP buttons, counts, registration link; lost/found panel with where and when; request panel with needed by).
- Owner actions (top right "..."): Edit, Mark resolved / fulfilled, Pin, Turn off comments, Delete, View RSVPs.
- Accepted answer block (doubts), then comment composer, sort toggle (Top / New), comment thread.

### 5.4 Composer

- Desktop: modal, 640 px wide. Mobile: full screen with "Cancel" and "Post" in the top bar.
- Order: Type picker (7 compact cards in a grid; collapses to a single row once chosen with a "Change" link) -> Where -> Title -> Body -> Type fields -> Images -> Post.
- Character counters appear only near limits (last 10%).

### 5.5 Communities list

Grid of cards (2 columns desktop, 1 mobile): 48 px avatar, name, type label, 2-line description, member count, Join/Joined button.

### 5.6 Community page

- Cover 160 px tall (desktop) / 112 px (mobile), plain `surface-2` with the name if no cover is set.
- Avatar 72 px overlapping the cover bottom edge by 24 px, with a 3 px `surface` ring.
- Name h1, type label, member count, Join, "New post".
- Tabs: Posts, Events, About, Members.

### 5.7 Directory

```
Directory
[ Search by name, subject, skill, or cabin...                     ]
[People] [Seniors open to mentor]
Role: (All) (Students) (Faculty)   Department: [AIML v]  Year: [Any v]  Teaches year: [3 v]

+--------------------------------+  +--------------------------------+
| (av) Prof. R. Kulkarni  [check]|  | (av) Sneha Patil    MENTOR     |
| FACULTY . Assistant Professor  |  | CSE . 3rd yr                   |
| AIML                           |  | Internships, Clubs             |
| Cabin: Block A, Room 304       |  |                                |
| Mon, Wed 2 to 4 PM             |  |                                |
| [Message]   [View profile]     |  | [Message]   [View profile]     |
+--------------------------------+  +--------------------------------+
```

- Cabin line uses `ink` (not gray) and a `MapPin` icon so it is easy to read on the move.

### 5.8 Profile

- Header: 96 px avatar, name h1, badges, department, year or designation, Message button, "..." (Report, Block).
- Faculty "Find me" panel prominently near the top: Cabin, Office hours, Email (copy button), Subjects taught.
- Student panel: Program, Year, Section, Skills chips, Links, Mentor topics if on.
- Tabs: Posts, Communities.

### 5.9 Messages

- Desktop: list 340 px + conversation pane. Conversation header shows the other person's avatar, name, role badge, and for faculty the cabin as subtext.
- Composer docked at bottom: image button, auto-grow textarea, Send.

### 5.10 Notifications

Simple list, unread rows on `accent-soft`, grouped by "Today", "This week", "Earlier".

### 5.11 Admin

Plain tables with sticky headers, action buttons per row, and a counts row at the top. Dense but readable (row height 52 px).

---

## 6. Microcopy and Tone

Voice: clear, friendly, brief, campus-local. Address the user as "you". Use sentence case for all UI text except type labels.

| Situation | Write | Avoid |
|---|---|---|
| Domain error | Use your college email ending in dypiu.ac.in. | Invalid email domain! |
| Empty doubt | No answers yet. Know the answer? Help a classmate. | Nothing here |
| Request button | Offer help | Respond to request |
| Resolve | Mark as fulfilled | Close ticket |
| Event RSVP | Going / Interested | Attend / Maybe |
| Delete confirm | Delete this post? This can't be undone. [Delete post] [Cancel] | Are you sure? [OK] |
| Pending faculty | Your faculty account is waiting for verification. | Account not approved |
| Network | You're offline. We'll reconnect automatically. | Network error 0 |
| Blocked DM | You can't message this person. | User has blocked you |

Dates and times: "Sat 18 Oct, 3:00 to 6:00 PM" (Indian 12-hour format with AM/PM, no seconds). Relative times in feeds: "now", "5m", "2h", "Yesterday", then "11 Oct". All times shown in `Asia/Kolkata`.

---

## 7. Accessibility

| Requirement | How |
|---|---|
| Contrast | All text pairs meet WCAG AA (4.5:1 body, 3:1 large); type label colors were picked to pass on their tint backgrounds |
| Keyboard | All actions reachable by Tab; visible focus ring (2 px accent, 2 px offset); Esc closes modals and lightbox; Enter/Space activate controls |
| Feed navigation | `j` / `k` move between posts, `Enter` opens (P1) |
| Screen readers | Semantic landmarks (`header`, `nav`, `main`, `aside`); cards are `article` with the title as heading; vote buttons have `aria-pressed` and labels "Upvote, current score 31"; live region announces new messages in an open conversation |
| Images | Alt text prompt in every picker; images without alt get `alt="Image attached by <name>"` |
| Forms | Every input has a visible label; errors linked with `aria-describedby`; focus moves to the first error on submit |
| Motion | `prefers-reduced-motion` respected |
| Zoom | Layout works at 200% browser zoom without horizontal scroll |
| Color | Type is never shown by color alone; the text label is always present |

---

## 8. Iconography

`lucide-react`, 20 px in navigation, 18 px inline, stroke width 1.75, color `currentColor`. Navigation icons: `Home`, `Users` (Communities), `BookUser` (Directory), `MessagesSquare`, `Bell`, `CircleUser`, `ShieldCheck` (Admin). Actions: `ArrowBigUp`/`ArrowBigDown`, `MessageCircle`, `ImagePlus`, `Send`, `MoreHorizontal`, `Pin`, `MapPin`, `Clock`, `CalendarDays`, `Check`.

---

## 9. Brand

- Name: **Campus Connect**. Mark: the letters "CC" in a 28 px square, `ink` background, white 14 px bold text, 2 px radius. No mascot.
- Favicon: the same mark at 32 px.
- The college name appears as plain text ("for DYPIU") in the auth screens and footer. Do not use the university's official logo without permission.

---

## 10. Design Handoff Checklist

- [ ] Tokens implemented in `tailwind.config.js` exactly as in section 2
- [ ] All 7 post type labels render with correct colors and icons
- [ ] Every screen in 03-APP-FLOW.md has loading, empty, and error states
- [ ] Mobile 360 px check on: Home, Post detail, Composer, Messages, Directory, Profile
- [ ] Keyboard-only pass on: Register, Compose post, Comment with image, Send DM with image
- [ ] Contrast spot-check with a checker on type labels and `ink-3`
- [ ] No pure black, no gradients, no glows anywhere (search the CSS for `#000`, `gradient`, `blur`)
