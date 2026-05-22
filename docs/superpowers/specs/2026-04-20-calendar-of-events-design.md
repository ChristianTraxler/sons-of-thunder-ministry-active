# Calendar of Events — Design

**Date:** 2026-04-20
**Status:** Approved for planning

## Summary

Add a "Calendar of Events" feature so the site admin can post upcoming ministry events (services, outings, meetings). Events appear on the public site in two places: a preview of the next 3 upcoming events on the homepage, and a full chronological list on a new dedicated page. Admin UI lives inside the existing Content tab of the admin dashboard, using a modal-based add/edit flow.

## Goals

- Admin can create, edit, and delete events without a redeploy.
- Site visitors see upcoming events at a glance on the homepage and can view the full list on a dedicated page.
- Past events auto-fade from upcoming views (hidden on homepage, collapsible on the events page).
- Implementation mirrors the existing sermons/settings Supabase pattern so the codebase stays consistent.

## Non-Goals (v1)

- No recurring events — each event is one dated instance. Weekly-service recurrence is deferred.
- No RSVP / signup functionality — just an optional external link per event.
- No per-event image uploads — consistent with the broader deferred image-upload decision (see `project_supabase_deferred_image_uploads.md`).
- No email reminders.
- No ICS / Google Calendar export.

## Data Model

### Supabase table: `events`

| Column        | Type                     | Notes                                                    |
|---------------|--------------------------|----------------------------------------------------------|
| `id`          | `uuid` PK                | `default gen_random_uuid()`                              |
| `title`       | `text` NOT NULL          | Event name                                               |
| `event_date`  | `date` NOT NULL          | The calendar day of the event                            |
| `start_time`  | `time` NULL              | Optional start time                                      |
| `end_time`    | `time` NULL              | Optional end time                                        |
| `location`    | `text` NULL              | Optional location string (free text)                     |
| `description` | `text` NULL              | Optional rich HTML, produced by the existing RichEditor  |
| `link_url`    | `text` NULL              | Optional external URL (RSVP / map / more info)           |
| `created_at`  | `timestamptz` default `now()` |                                                     |
| `updated_at`  | `timestamptz` default `now()` |                                                     |

### RLS policies

Same pattern as `sermons`:

- `select` — allowed for `anon` and `authenticated` (public read).
- `insert` / `update` / `delete` — allowed only when `auth.role() = 'authenticated'`.

### Indexes

- `event_date` ascending — supports the ordering used by both upcoming queries.

## Module Architecture

New JS modules, each mirroring existing patterns:

- **`js/events.js`** — data module. Mirrors `js/sermons.js`:
  - `fromRow(row)` / `toRow(obj)` — snake_case ↔ camelCase translation at the DB boundary.
  - `getAll()` — all events, ordered by `event_date` ascending.
  - `getUpcoming(limit)` — `event_date >= today`, ordered ascending, optional `limit`.
  - `getPast()` — `event_date < today`, ordered descending.
  - `getById(id)`, `save(event)`, `update(id, patch)`, `remove(id)`.
- **`js/events-admin.js`** — admin Content-tab UI logic. Listens once `initDashboard` fires; renders the list, wires the Add Event button, and manages the add/edit and delete modals. Reuses `RichEditor` for the description field.
- **`js/events-page.js`** — public-page renderer. Single entry point used by both the homepage preview block and the dedicated events page; each calls an exposed function (`renderHomepagePreview()` / `renderEventsPage()`) based on the DOM present.

"Today" is computed client-side in `America/New_York` time (via `Intl.DateTimeFormat`) to match the ministry's locale, then passed to Supabase as a `YYYY-MM-DD` string.

## Admin UI (Content tab)

Appended inside `#tab-content` in `admin-dashboard.html`, after the "Welcome Message Scripture" section.

### Calendar of Events card

- Header row: `<h2>Calendar of Events</h2>` on the left, `<button class="btn-publish">Add Event</button>` on the right.
- Body: event list.
  - Upcoming events first, ordered ascending by `event_date`.
  - A "Past Events" divider, followed by past events ordered descending, with muted styling.
  - Each row shows: title (bold), formatted date + time, location (dim). Edit and Delete buttons on the right.
  - Empty state: "No events yet. Click Add Event to create one."

### Add / Edit modal

Reuses the existing `.modal-overlay` / `.modal-card` styling from the sermon delete modal, with a wider variant for the form.

Fields in order:

1. Title (text, required)
2. Date (date, required)
3. Start Time (time, optional)
4. End Time (time, optional)
5. Location (text, optional)
6. Description (RichEditor instance, optional)
7. Link URL (url, optional)

Actions: Cancel (closes modal, discards) / Save (validates, calls `Events.save` or `Events.update`, shows toast, re-renders list).

Client-side validation:

- Title and Date required.
- If both `start_time` and `end_time` are provided, `end_time` must be ≥ `start_time`.
- `link_url` must parse as a URL if present (relies on `type="url"` input behavior).

### Delete confirmation

Reuses the existing sermon delete modal, with text swapped to the event title.

## Public Display

### Homepage (`index.html`)

New `<section class="events-section" id="events">` inserted between `#message` and `#board`.

- Section label: "What's Coming Up".
- Section title: "Upcoming Events".
- Up to 3 nearest upcoming events rendered as cards:
  - Left: date badge (month abbreviation + day number).
  - Right: title, time range (or "All day" if no times), location, a 2-line description excerpt.
  - "More Info" button if `link_url` is set.
- A "View All Events" button at the bottom, linking to `events.html`.
- **Section is hidden entirely** when `getUpcoming()` returns zero rows. No empty-state placeholder on the public homepage.

New nav link `<li><a href="events.html">Events</a></li>` inserted between Message and Board in `#navLinks`.

### Dedicated page (`events.html`)

New file, matching the layout of `sermons.html`:

- Header/hero with section label "Mark Your Calendar", title "Events", short intro paragraph.
- Full chronological list of upcoming events, same card design as the homepage, larger.
- Collapsible "Past Events" section below, initially collapsed. Expanding triggers a `Events.getPast()` load.
- Empty state on this page: "No upcoming events right now. Check back soon."

### Formatting rules

- Date: `Fri, May 15, 2026` (using `toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })`).
- Time range:
  - Both present: `7:00 – 9:00 PM`.
  - Only `start_time`: `7:00 PM`.
  - Neither: `All day`.
- Description is rich HTML written into the card via `innerHTML` (trusted because only authenticated admins can write it, same trust model as sermon content).
- Location is plain text, escaped.

## Data Flow

1. Admin opens Content tab → `EventsAdmin.init()` calls `Events.getAll()` → renders list split into upcoming / past.
2. Admin clicks Add Event → modal opens with empty form → Save → `Events.save(obj)` → toast + re-render.
3. Admin clicks Edit → modal opens pre-populated via `Events.getById(id)` → Save → `Events.update(id, obj)` → re-render.
4. Admin clicks Delete → confirmation modal → `Events.remove(id)` → re-render.
5. Public homepage on load: `EventsPage.renderHomepagePreview()` calls `Events.getUpcoming(3)`; if zero, hides the section.
6. Events page on load: `EventsPage.renderEventsPage()` calls `Events.getUpcoming()`; past-events toggle calls `Events.getPast()` on first expand.

## Error Handling

- All Supabase calls follow the existing pattern: log `res.error` to console, return `null` / `[]` from read helpers, throw from write helpers so UI can surface a toast.
- Admin toasts on failure: `"Save failed"`, `"Delete failed"`, etc. — reusing the existing `showToast(msg, 'error')` pattern.
- Public pages silently hide the events section if the fetch fails — no error UI to the visitor.

## Testing Plan

Manual verification (no automated tests exist in this project):

1. **Admin CRUD** — create, edit, delete an event; confirm list updates and toasts fire.
2. **Required-field validation** — saving without title or date is blocked.
3. **Time-range validation** — end < start is blocked.
4. **Homepage preview** — with 0 events (section hidden), 1–3 events (all shown), 5+ events (only nearest 3 shown).
5. **Events page** — upcoming list renders; past-events toggle loads past events on expand; empty state shows when no upcoming events.
6. **Past vs upcoming boundary** — an event dated today appears in upcoming; yesterday appears in past.
7. **Timezone** — verify "today" boundary uses America/New_York by testing at late-evening UTC.
8. **RLS** — attempt to write from a logged-out browser session; confirm insert/update/delete are rejected.
9. **Nav link** — "Events" link appears and navigates to `events.html` on both desktop and mobile nav.

## Open Questions

None — all covered in the brainstorming session.

## References

- Existing patterns: `js/sermons.js`, `js/settings.js`, `admin-dashboard.html`, `sermons.html`.
- Auto-memory: `project_supabase_deferred_image_uploads.md` (justifies no per-event images).
