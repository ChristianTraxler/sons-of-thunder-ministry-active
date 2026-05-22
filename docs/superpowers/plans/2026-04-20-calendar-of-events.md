# Calendar of Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-managed Calendar of Events feature with a homepage preview and a dedicated public events page.

**Architecture:** Mirror the existing sermons/settings Supabase pattern. New `events` table with public-read / admin-write RLS, a `js/events.js` CRUD module, a modal-based admin UI in the Content tab, and a public events page plus homepage preview section.

**Tech Stack:** Vanilla JS (IIFE modules), Supabase JS SDK, static HTML/CSS, existing `RichEditor` for the description field. No build step, no test framework — verification is via browser.

**Testing note:** This project has no automated test runner. Verification steps in each task are manual browser checks. Run them and confirm the expected outcome before moving on; if a step fails, fix before committing.

**Spec:** [docs/superpowers/specs/2026-04-20-calendar-of-events-design.md](../specs/2026-04-20-calendar-of-events-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `docs/supabase/events-migration.sql` | create | DDL for `events` table + RLS policies, paste-able into Supabase SQL editor |
| `js/events.js` | create | Data module — CRUD + formatting helpers; mirrors `js/sermons.js` |
| `js/events-admin.js` | create | Admin Content-tab UI — list render, add/edit modal, delete |
| `js/events-page.js` | create | Public renderer — homepage preview + events page |
| `css/admin.css` | modify | Styles for admin events list and event form modal |
| `css/events.css` | create | Public event-card styles (homepage + events page) |
| `admin-dashboard.html` | modify | Inject Calendar of Events section + event modal, load scripts |
| `events.html` | create | Dedicated public page |
| `index.html` | modify | Add nav link, add `#events` section, load scripts |
| `sermons.html` | modify | Add nav link + footer link for consistency |
| `chariots-for-jesus.html` | modify | Add nav link + footer link for consistency |
| `fuel-for-the-soul.html` | modify | Add nav link + footer link for consistency |

---

### Task 1: Create Supabase `events` table + RLS policies

**Files:**
- Create: `docs/supabase/events-migration.sql`

- [ ] **Step 1: Write the migration SQL**

Create `docs/supabase/events-migration.sql`:

```sql
-- Calendar of Events table
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text,
  description text,
  link_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_event_date_idx
  on public.events (event_date);

alter table public.events enable row level security;

-- Public read
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- Authenticated write
drop policy if exists "events_auth_insert" on public.events;
create policy "events_auth_insert"
  on public.events
  for insert
  to authenticated
  with check (true);

drop policy if exists "events_auth_update" on public.events;
create policy "events_auth_update"
  on public.events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "events_auth_delete" on public.events;
create policy "events_auth_delete"
  on public.events
  for delete
  to authenticated
  using (true);

-- Keep updated_at current
create or replace function public.events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.events_set_updated_at();
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase project SQL editor and paste the full contents of `docs/supabase/events-migration.sql`. Run it.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table exists**

In the Supabase Table Editor, confirm `events` appears with the columns: `id`, `title`, `event_date`, `start_time`, `end_time`, `location`, `description`, `link_url`, `created_at`, `updated_at`. Under the table's "Authentication" / "Policies" tab, confirm 4 policies are listed.

- [ ] **Step 4: Commit**

```bash
git add docs/supabase/events-migration.sql
git commit -m "feat(events): add events table migration with RLS"
```

---

### Task 2: Data module `js/events.js`

**Files:**
- Create: `js/events.js`

- [ ] **Step 1: Write the Events module**

Create `js/events.js`:

```javascript
/* =============================================
   EVENTS.JS — Event CRUD Module (Supabase)

   All methods return promises. DB columns use
   snake_case; UI code uses camelCase, so this
   module translates at the boundary.

   Also exposes formatting helpers used by both
   the admin list and the public event cards.
   ============================================= */

var Events = (function () {
	var TABLE = 'events';

	// DB row → UI object
	function fromRow(row) {
		if (!row) return null;
		return {
			id: row.id,
			title: row.title || '',
			eventDate: row.event_date || '',
			startTime: row.start_time || '',
			endTime: row.end_time || '',
			location: row.location || '',
			description: row.description || '',
			linkUrl: row.link_url || '',
			createdAt: row.created_at
		};
	}

	// UI object → DB row (for insert/update)
	function toRow(obj) {
		var row = {};
		if ('title' in obj)       row.title = obj.title;
		if ('eventDate' in obj)   row.event_date = obj.eventDate || null;
		if ('startTime' in obj)   row.start_time = obj.startTime || null;
		if ('endTime' in obj)     row.end_time = obj.endTime || null;
		if ('location' in obj)    row.location = obj.location || null;
		if ('description' in obj) row.description = obj.description || null;
		if ('linkUrl' in obj)     row.link_url = obj.linkUrl || null;
		return row;
	}

	// "Today" in America/New_York as YYYY-MM-DD
	function todayNY() {
		var parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/New_York',
			year: 'numeric', month: '2-digit', day: '2-digit'
		}).format(new Date());
		return parts; // en-CA already produces YYYY-MM-DD
	}

	function getAll() {
		return sb.from(TABLE)
			.select('*')
			.order('event_date', { ascending: true })
			.then(function (res) {
				if (res.error) { console.error('Events.getAll', res.error); return []; }
				return (res.data || []).map(fromRow);
			});
	}

	function getUpcoming(limit) {
		var q = sb.from(TABLE)
			.select('*')
			.gte('event_date', todayNY())
			.order('event_date', { ascending: true });
		if (typeof limit === 'number') q = q.limit(limit);
		return q.then(function (res) {
			if (res.error) { console.error('Events.getUpcoming', res.error); return []; }
			return (res.data || []).map(fromRow);
		});
	}

	function getPast() {
		return sb.from(TABLE)
			.select('*')
			.lt('event_date', todayNY())
			.order('event_date', { ascending: false })
			.then(function (res) {
				if (res.error) { console.error('Events.getPast', res.error); return []; }
				return (res.data || []).map(fromRow);
			});
	}

	function getById(id) {
		return sb.from(TABLE)
			.select('*')
			.eq('id', id)
			.single()
			.then(function (res) {
				if (res.error) return null;
				return fromRow(res.data);
			});
	}

	function save(event) {
		return sb.from(TABLE)
			.insert(toRow(event))
			.select()
			.single()
			.then(function (res) {
				if (res.error) { console.error('Events.save', res.error); throw res.error; }
				return fromRow(res.data);
			});
	}

	function update(id, patch) {
		return sb.from(TABLE)
			.update(toRow(patch))
			.eq('id', id)
			.select()
			.single()
			.then(function (res) {
				if (res.error) { console.error('Events.update', res.error); throw res.error; }
				return fromRow(res.data);
			});
	}

	function remove(id) {
		return sb.from(TABLE)
			.delete()
			.eq('id', id)
			.then(function (res) {
				if (res.error) { console.error('Events.remove', res.error); throw res.error; }
			});
	}

	// ---- Formatting helpers ----

	function formatDate(ymd) {
		if (!ymd) return '';
		var d = new Date(ymd + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
		});
	}

	function formatDateBadge(ymd) {
		if (!ymd) return { month: '', day: '' };
		var d = new Date(ymd + 'T00:00:00');
		return {
			month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
			day: String(d.getDate())
		};
	}

	function formatTime(hms) {
		if (!hms) return '';
		// hms is "HH:MM" or "HH:MM:SS"
		var parts = hms.split(':');
		var h = parseInt(parts[0], 10);
		var m = parts[1] || '00';
		var suffix = h >= 12 ? 'PM' : 'AM';
		var h12 = h % 12 === 0 ? 12 : h % 12;
		return h12 + ':' + m + ' ' + suffix;
	}

	function formatTimeRange(start, end) {
		if (!start && !end) return 'All day';
		if (start && !end)  return formatTime(start);
		if (!start && end)  return 'Until ' + formatTime(end);
		return formatTime(start) + ' – ' + formatTime(end);
	}

	return {
		todayNY: todayNY,
		getAll: getAll,
		getUpcoming: getUpcoming,
		getPast: getPast,
		getById: getById,
		save: save,
		update: update,
		remove: remove,
		formatDate: formatDate,
		formatDateBadge: formatDateBadge,
		formatTime: formatTime,
		formatTimeRange: formatTimeRange
	};
})();
```

- [ ] **Step 2: Smoke test in the browser console**

No HTML references the module yet, so include it temporarily to test. In `admin-dashboard.html`, add `<script src="js/events.js"></script>` just before `</body>` in the existing script block (it will be properly added in Task 3). Reload the admin dashboard page and open the browser console.

Run:

```javascript
Events.todayNY()
Events.getAll().then(console.log)
```

Expected: `todayNY()` returns a `YYYY-MM-DD` string for today. `getAll()` logs `[]` (no events yet). No errors in the console.

If you added the script tag temporarily for this smoke test, remove it before committing — Task 3 adds the permanent script tag.

- [ ] **Step 3: Commit**

```bash
git add js/events.js
git commit -m "feat(events): add Events CRUD module with formatting helpers"
```

---

### Task 3: Admin Content tab — HTML + modal

**Files:**
- Modify: `admin-dashboard.html`

- [ ] **Step 1: Add the Calendar of Events section in the Content tab**

Find the closing `</section>` of the Welcome Message Scripture block inside `#tab-content` (currently around line 117). Immediately after it, before the closing `</div>` of `.settings-stack`, insert:

```html
<!-- Calendar of Events -->
<section class="settings-section">
	<div class="events-admin-header">
		<h2>Calendar of Events</h2>
		<button class="btn-publish" id="addEventBtn" type="button">Add Event</button>
	</div>
	<div class="events-admin-list" id="eventsAdminList">
		<p class="sidebar-empty">Loading…</p>
	</div>
</section>
```

- [ ] **Step 2: Add the event add/edit modal**

Find the existing `<!-- Delete confirmation modal -->` block. Immediately before it, add:

```html
<!-- Event add/edit modal -->
<div class="modal-overlay" id="eventModal">
	<div class="modal-card modal-card-form">
		<h3 id="eventModalTitle">Add Event</h3>

		<div class="form-row">
			<div class="form-group">
				<label for="evTitle">Title</label>
				<input type="text" id="evTitle" placeholder="Event name">
			</div>
			<div class="form-group">
				<label for="evDate">Date</label>
				<input type="date" id="evDate">
			</div>
		</div>

		<div class="form-row">
			<div class="form-group">
				<label for="evStart">Start Time</label>
				<input type="time" id="evStart">
			</div>
			<div class="form-group">
				<label for="evEnd">End Time</label>
				<input type="time" id="evEnd">
			</div>
		</div>

		<div class="form-group">
			<label for="evLocation">Location</label>
			<input type="text" id="evLocation" placeholder="Where is it happening?">
		</div>

		<div class="form-group">
			<label>Description</label>
			<div class="editor-wrapper" id="evEditorWrapper"></div>
		</div>

		<div class="form-group">
			<label for="evLink">Link (optional)</label>
			<input type="url" id="evLink" placeholder="https://…">
		</div>

		<div class="modal-actions">
			<button class="btn-modal-cancel" id="evCancelBtn" type="button">Cancel</button>
			<button class="btn-modal-delete btn-modal-save" id="evSaveBtn" type="button">Save Event</button>
		</div>
	</div>
</div>
```

- [ ] **Step 3: Load the new scripts**

Find the existing script tags near the bottom of the file (`js/supabase-client.js`, `js/auth.js`, etc.). After the existing `<script src="js/rich-editor.js"></script>` line, add:

```html
<script src="js/events.js"></script>
<script src="js/events-admin.js"></script>
```

- [ ] **Step 4: Verify in the browser**

Reload the admin dashboard and switch to the Content tab.

Expected:
- A "Calendar of Events" card appears below "Welcome Message Scripture" with an "Add Event" button.
- List area shows "Loading…" (it will get replaced in Task 4 — harmless for now).
- No console errors about missing files (the `js/events-admin.js` 404 will happen — that's expected and fixed by Task 4; skip this verification step if you prefer to chain Tasks 3 and 4).

- [ ] **Step 5: Commit**

```bash
git add admin-dashboard.html
git commit -m "feat(events): add Calendar of Events section and modal to admin"
```

---

### Task 4: Admin events JS `js/events-admin.js`

**Files:**
- Create: `js/events-admin.js`
- Modify: `admin-dashboard.html` (hook init call inside existing `initDashboard`)

- [ ] **Step 1: Write the admin module**

Create `js/events-admin.js`:

```javascript
/* =============================================
   EVENTS-ADMIN.JS — Admin Calendar of Events

   Binds the Content-tab events list, add/edit
   modal, and delete flow. Reuses the existing
   RichEditor for the description field and the
   existing delete modal for confirmations.
   ============================================= */

var EventsAdmin = (function () {
	var listEl, addBtn, modal, modalTitle;
	var titleInput, dateInput, startInput, endInput, locInput, linkInput;
	var cancelBtn, saveBtn;
	var editor; // RichEditor instance id (string)
	var editingId = null;
	var deletingId = null;
	var showToast, openDeleteModal;

	function init(opts) {
		showToast = opts.showToast;
		openDeleteModal = opts.openDeleteModal;

		listEl       = document.getElementById('eventsAdminList');
		addBtn       = document.getElementById('addEventBtn');
		modal        = document.getElementById('eventModal');
		modalTitle   = document.getElementById('eventModalTitle');
		titleInput   = document.getElementById('evTitle');
		dateInput    = document.getElementById('evDate');
		startInput   = document.getElementById('evStart');
		endInput     = document.getElementById('evEnd');
		locInput     = document.getElementById('evLocation');
		linkInput    = document.getElementById('evLink');
		cancelBtn    = document.getElementById('evCancelBtn');
		saveBtn      = document.getElementById('evSaveBtn');

		editor = 'evEditorWrapper';
		RichEditor.init(editor);

		addBtn.addEventListener('click', function () { openModal('add'); });
		cancelBtn.addEventListener('click', closeModal);
		saveBtn.addEventListener('click', onSave);

		modal.addEventListener('click', function (e) {
			if (e.target === modal) closeModal();
		});

		renderList();
	}

	function escapeHtml(str) {
		var d = document.createElement('div');
		d.textContent = str == null ? '' : str;
		return d.innerHTML;
	}

	function renderList() {
		listEl.innerHTML = '<p class="sidebar-empty">Loading…</p>';
		Promise.all([Events.getUpcoming(), Events.getPast()]).then(function (results) {
			var upcoming = results[0];
			var past = results[1];

			if (upcoming.length === 0 && past.length === 0) {
				listEl.innerHTML = '<p class="sidebar-empty">No events yet. Click Add Event to create one.</p>';
				return;
			}

			var html = '';
			if (upcoming.length > 0) {
				html += '<div class="events-admin-subhead">Upcoming</div>';
				upcoming.forEach(function (ev) { html += rowHtml(ev, false); });
			}
			if (past.length > 0) {
				html += '<div class="events-admin-subhead events-admin-subhead-past">Past Events</div>';
				past.forEach(function (ev) { html += rowHtml(ev, true); });
			}
			listEl.innerHTML = html;

			listEl.querySelectorAll('.btn-edit-event').forEach(function (btn) {
				btn.addEventListener('click', function () {
					openModal('edit', btn.getAttribute('data-id'));
				});
			});
			listEl.querySelectorAll('.btn-delete-event').forEach(function (btn) {
				btn.addEventListener('click', function () {
					onDelete(btn.getAttribute('data-id'));
				});
			});
		});
	}

	function rowHtml(ev, isPast) {
		var dateStr = Events.formatDate(ev.eventDate);
		var timeStr = Events.formatTimeRange(ev.startTime, ev.endTime);
		var meta = dateStr + (timeStr && timeStr !== 'All day' ? ' · ' + timeStr : '');
		if (ev.location) meta += ' · ' + escapeHtml(ev.location);
		return '<div class="events-admin-item' + (isPast ? ' is-past' : '') + '">'
			+ '<div class="events-admin-item-main">'
			+ '<h4>' + escapeHtml(ev.title) + '</h4>'
			+ '<div class="events-admin-meta">' + meta + '</div>'
			+ '</div>'
			+ '<div class="events-admin-actions">'
			+ '<button class="btn-edit-event" data-id="' + ev.id + '">Edit</button>'
			+ '<button class="btn-delete-event" data-id="' + ev.id + '">Delete</button>'
			+ '</div></div>';
	}

	function openModal(mode, id) {
		editingId = null;
		if (mode === 'edit' && id) {
			Events.getById(id).then(function (ev) {
				if (!ev) return;
				editingId = id;
				titleInput.value = ev.title;
				dateInput.value = ev.eventDate || '';
				startInput.value = ev.startTime ? ev.startTime.substring(0, 5) : '';
				endInput.value = ev.endTime ? ev.endTime.substring(0, 5) : '';
				locInput.value = ev.location || '';
				linkInput.value = ev.linkUrl || '';
				RichEditor.setContent(ev.description || '');
				modalTitle.textContent = 'Edit Event';
				saveBtn.textContent = 'Update Event';
				modal.classList.add('active');
			});
		} else {
			titleInput.value = '';
			dateInput.value = Events.todayNY();
			startInput.value = '';
			endInput.value = '';
			locInput.value = '';
			linkInput.value = '';
			RichEditor.clear();
			modalTitle.textContent = 'Add Event';
			saveBtn.textContent = 'Save Event';
			modal.classList.add('active');
		}
	}

	function closeModal() {
		modal.classList.remove('active');
	}

	function onSave() {
		var title = titleInput.value.trim();
		var date  = dateInput.value;
		if (!title) { titleInput.focus(); showToast('Title is required', 'error'); return; }
		if (!date)  { dateInput.focus();  showToast('Date is required',  'error'); return; }

		var start = startInput.value;
		var end   = endInput.value;
		if (start && end && end < start) {
			showToast('End time must be after start time', 'error');
			return;
		}

		var data = {
			title: title,
			eventDate: date,
			startTime: start || null,
			endTime: end || null,
			location: locInput.value.trim(),
			description: RichEditor.getContent(),
			linkUrl: linkInput.value.trim()
		};

		saveBtn.disabled = true;
		var op = editingId
			? Events.update(editingId, data).then(function () { showToast('Event updated'); })
			: Events.save(data).then(function () { showToast('Event saved'); });

		op.then(function () {
			closeModal();
			renderList();
		}).catch(function (err) {
			showToast(err.message || 'Save failed', 'error');
		}).then(function () {
			saveBtn.disabled = false;
		});
	}

	function onDelete(id) {
		deletingId = id;
		Events.getById(id).then(function (ev) {
			var title = ev ? ev.title : 'this event';
			openDeleteModal({
				title: 'Delete Event',
				message: 'Are you sure you want to delete "' + title + '"? This cannot be undone.',
				onConfirm: function () {
					Events.remove(deletingId).then(function () {
						deletingId = null;
						showToast('Event deleted');
						renderList();
					}).catch(function (err) {
						showToast(err.message || 'Delete failed', 'error');
					});
				}
			});
		});
	}

	return { init: init };
})();
```

- [ ] **Step 2: Generalize the existing delete modal to accept configurable text + callback**

In `admin-dashboard.html`, inside the `initDashboard` function (the existing inline `<script>` block), find the sermon delete flow. Currently `confirmDeleteBtn.addEventListener` is hardcoded to delete a sermon. Refactor it so both sermons and events can use the same modal.

Replace the sermon delete block (the declarations of `deletingId`, the delete modal click handlers, and `confirmDeleteBtn`/`cancelDeleteBtn`/`deleteModal` handlers) with a small reusable helper. Add near the top of `initDashboard`, just after `var toastEl = document.getElementById('toast');`:

```javascript
// ---- Shared delete modal ----
var pendingDeleteConfirm = null;
function openDeleteModal(opts) {
	document.querySelector('#deleteModal h3').textContent = opts.title || 'Delete';
	document.getElementById('deleteModalText').textContent = opts.message || 'Are you sure?';
	pendingDeleteConfirm = opts.onConfirm || null;
	deleteModal.classList.add('active');
}
function closeDeleteModal() {
	pendingDeleteConfirm = null;
	deleteModal.classList.remove('active');
}
```

Then replace the existing sermon `confirmDeleteBtn`/`cancelDeleteBtn`/`deleteModal` click handlers (the three `addEventListener` blocks) with:

```javascript
confirmDeleteBtn.addEventListener('click', function () {
	if (pendingDeleteConfirm) pendingDeleteConfirm();
	closeDeleteModal();
});
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', function (e) {
	if (e.target === deleteModal) closeDeleteModal();
});
```

And update the sermon sidebar delete handler (inside `renderSidebar`, the `.btn-delete-sermon` click handler) to use the new helper:

```javascript
sidebarEl.querySelectorAll('.btn-delete-sermon').forEach(function (btn) {
	btn.addEventListener('click', function () {
		var id = btn.getAttribute('data-id');
		Sermons.getById(id).then(function (sermon) {
			var title = sermon ? sermon.title : 'this sermon';
			openDeleteModal({
				title: 'Delete Sermon',
				message: 'Are you sure you want to delete "' + title + '"? This cannot be undone.',
				onConfirm: function () {
					Sermons.remove(id).then(function () {
						if (editingId === id) cancelEdit();
						showToast('Sermon deleted');
						renderSidebar();
					}).catch(function (err) {
						showToast(err.message || 'Delete failed', 'error');
					});
				}
			});
		});
	});
});
```

Delete the old `deletingId` variable declaration and any remaining references to it in the sermon flow.

- [ ] **Step 3: Initialize EventsAdmin from `initDashboard`**

At the end of `initDashboard`, just before the final call to `renderSidebar();`, add:

```javascript
EventsAdmin.init({
	showToast: showToast,
	openDeleteModal: openDeleteModal
});
```

- [ ] **Step 4: Verify in the browser — full admin CRUD**

Reload the admin dashboard, go to the Content tab.

Verify in order:
1. Empty state shows "No events yet. Click Add Event to create one."
2. Click **Add Event** → modal opens, Date field defaults to today.
3. Save with empty title → toast "Title is required", modal stays open.
4. Fill Title = "Test Event", Date = a future date, Location = "Test Hall", Description = "Some text", Save → toast "Event saved", modal closes, list shows the event under "Upcoming".
5. Click **Edit** on the row → modal re-opens pre-filled. Change title → Save → toast "Event updated", list updates.
6. Click **Delete** → confirmation modal shows "Delete Event / Are you sure you want to delete ...?". Confirm → toast "Event deleted", list returns to empty state.
7. Verify the existing Sermon delete flow still works (delete any test sermon, then re-create if needed).
8. Create an event dated *yesterday* → it appears under "Past Events" with muted styling (styling arrives in Task 5; correct grouping should still be visible).

- [ ] **Step 5: Commit**

```bash
git add js/events-admin.js admin-dashboard.html
git commit -m "feat(events): wire admin events CRUD with shared delete modal"
```

---

### Task 5: Admin events CSS

**Files:**
- Modify: `css/admin.css`

- [ ] **Step 1: Append event-list and form-modal styles**

Append to the bottom of `css/admin.css`:

```css
/* =============================================
   ADMIN — Calendar of Events
   ============================================= */

.events-admin-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	margin-bottom: 1rem;
}
.events-admin-header h2 {
	margin: 0;
}
.events-admin-header .btn-publish {
	width: auto;
	padding: 0.6rem 1.4rem;
	font-size: 0.85rem;
	margin: 0;
}

.events-admin-list {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.events-admin-subhead {
	font-family: 'Cinzel', serif;
	font-size: 0.75rem;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--gold);
	margin: 0.8rem 0 0.2rem;
}
.events-admin-subhead-past {
	color: var(--text-muted);
}

.events-admin-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding: 0.9rem 1rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 6px;
}
.events-admin-item.is-past {
	opacity: 0.55;
}
.events-admin-item-main h4 {
	margin: 0 0 0.25rem;
	font-size: 1rem;
}
.events-admin-meta {
	font-size: 0.85rem;
	color: var(--text-muted);
}
.events-admin-actions {
	display: flex;
	gap: 0.4rem;
	flex-shrink: 0;
}
.events-admin-actions button {
	padding: 0.45rem 0.9rem;
	font-size: 0.8rem;
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: var(--text);
	border-radius: 4px;
	cursor: pointer;
	transition: border-color 0.2s, color 0.2s;
}
.events-admin-actions button:hover {
	border-color: var(--gold);
	color: var(--gold);
}
.events-admin-actions .btn-delete-event:hover {
	border-color: #c45;
	color: #f66;
}

/* Wider modal for the event form */
.modal-card.modal-card-form {
	max-width: 640px;
	width: calc(100vw - 2rem);
	max-height: calc(100vh - 2rem);
	overflow-y: auto;
	text-align: left;
}
.modal-card.modal-card-form h3 {
	margin-top: 0;
	text-align: left;
}
.modal-card.modal-card-form .form-row {
	display: flex;
	gap: 1rem;
}
.modal-card.modal-card-form .form-row .form-group {
	flex: 1;
}
.btn-modal-save {
	background: var(--gold);
	color: #111;
}
.btn-modal-save:hover {
	background: var(--gold-light);
}
```

- [ ] **Step 2: Verify in the browser**

Reload the admin dashboard → Content tab.

Verify:
- "Calendar of Events" header has the "Add Event" button on the right.
- Event rows have gold-tinted borders, title + metadata aligned left, Edit/Delete aligned right.
- Past events show at ~55% opacity under a dimmer "Past Events" divider.
- Opening the Add Event modal → form card is wider than the delete modal, scrolls if the screen is short, date/time pairs sit side by side.

- [ ] **Step 3: Commit**

```bash
git add css/admin.css
git commit -m "style(events): admin calendar list and event form modal"
```

---

### Task 6: Public events loader `js/events-page.js`

**Files:**
- Create: `js/events-page.js`

- [ ] **Step 1: Write the renderer**

Create `js/events-page.js`:

```javascript
/* =============================================
   EVENTS-PAGE.JS — Public event rendering

   Exposes two entry points:
     EventsPage.renderHomepagePreview() — #events
       section on the homepage; up to 3 upcoming
       events, hides the whole section if none.
     EventsPage.renderEventsPage()     — full list
       on events.html, with a collapsible past
       events section.
   ============================================= */

var EventsPage = (function () {

	function escapeHtml(str) {
		var d = document.createElement('div');
		d.textContent = str == null ? '' : str;
		return d.innerHTML;
	}

	function cardHtml(ev, variant) {
		var badge = Events.formatDateBadge(ev.eventDate);
		var dateStr = Events.formatDate(ev.eventDate);
		var timeStr = Events.formatTimeRange(ev.startTime, ev.endTime);

		var metaBits = [dateStr];
		if (timeStr) metaBits.push(timeStr);
		if (ev.location) metaBits.push(escapeHtml(ev.location));

		var descHtml = ev.description
			? '<div class="event-card-desc' + (variant === 'preview' ? ' event-card-desc-clamp' : '') + '">' + ev.description + '</div>'
			: '';

		var linkHtml = ev.linkUrl
			? '<a class="event-card-link" href="' + escapeHtml(ev.linkUrl) + '" target="_blank" rel="noopener">More Info</a>'
			: '';

		return '<article class="event-card">'
			+ '<div class="event-card-badge">'
			+ '<span class="event-card-badge-month">' + badge.month + '</span>'
			+ '<span class="event-card-badge-day">' + badge.day + '</span>'
			+ '</div>'
			+ '<div class="event-card-body">'
			+ '<h3 class="event-card-title">' + escapeHtml(ev.title) + '</h3>'
			+ '<div class="event-card-meta">' + metaBits.join(' · ') + '</div>'
			+ descHtml
			+ linkHtml
			+ '</div>'
			+ '</article>';
	}

	function renderHomepagePreview() {
		var section = document.getElementById('events');
		if (!section) return;
		var listEl = section.querySelector('.events-preview-list');
		if (!listEl) return;

		Events.getUpcoming(3).then(function (events) {
			if (events.length === 0) {
				section.style.display = 'none';
				return;
			}
			listEl.innerHTML = events.map(function (e) { return cardHtml(e, 'preview'); }).join('');
		}).catch(function () {
			section.style.display = 'none';
		});
	}

	function renderEventsPage() {
		var upcomingEl = document.getElementById('eventsUpcomingList');
		var pastWrap   = document.getElementById('eventsPastWrap');
		var pastList   = document.getElementById('eventsPastList');
		var pastToggle = document.getElementById('eventsPastToggle');
		if (!upcomingEl) return;

		Events.getUpcoming().then(function (events) {
			if (events.length === 0) {
				upcomingEl.innerHTML = '<p class="events-empty">No upcoming events right now. Check back soon.</p>';
				return;
			}
			upcomingEl.innerHTML = events.map(function (e) { return cardHtml(e, 'full'); }).join('');
		});

		var pastLoaded = false;
		if (pastToggle) {
			pastToggle.addEventListener('click', function () {
				var isOpen = pastWrap.classList.toggle('is-open');
				pastToggle.textContent = isOpen ? 'Hide past events' : 'Show past events';
				if (isOpen && !pastLoaded) {
					pastLoaded = true;
					pastList.innerHTML = '<p class="events-empty">Loading…</p>';
					Events.getPast().then(function (events) {
						if (events.length === 0) {
							pastList.innerHTML = '<p class="events-empty">No past events.</p>';
							return;
						}
						pastList.innerHTML = events.map(function (e) { return cardHtml(e, 'full'); }).join('');
					});
				}
			});
		}
	}

	return {
		renderHomepagePreview: renderHomepagePreview,
		renderEventsPage: renderEventsPage
	};
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/events-page.js
git commit -m "feat(events): add public event card renderer"
```

(This module is exercised and verified in Tasks 7–9.)

---

### Task 7: Dedicated public page `events.html`

**Files:**
- Create: `events.html`

- [ ] **Step 1: Create the page**

Create `events.html` with the same nav/footer structure as `sermons.html`:

```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Events — Sons of Thunder Ministry, Inc.</title>
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
		<link rel="stylesheet" href="css/default.css">
		<link rel="stylesheet" href="css/styles.css">
		<link rel="stylesheet" href="css/responsiveness.css">
		<link rel="stylesheet" href="css/events.css">
		<link rel="stylesheet" href="css/admin.css">
	</head>

	<body>
		<nav id="mainNav" class="scrolled">
			<a href="index.html" class="nav-logo">STM</a>
			<ul class="nav-links" id="navLinks">
				<li><a href="index.html#about" onclick="closeMenu()">About</a></li>
				<li><a href="index.html#ministries" onclick="closeMenu()">Ministries</a></li>
				<li><a href="index.html#message" onclick="closeMenu()">Message</a></li>
				<li><a href="events.html" onclick="closeMenu()">Events</a></li>
				<li><a href="index.html#board" onclick="closeMenu()">Board</a></li>
				<li><a href="index.html#sermons" onclick="closeMenu()">Sermons</a></li>
				<li class="nav-give-item"><a href="index.html#donate" onclick="closeMenu()" class="nav-donate nav-donate-menu">Give</a></li>
				<li class="nav-admin-item"><a href="admin-login.html" onclick="closeMenu()">Admin</a></li>
			</ul>
			<div class="nav-right">
				<a href="index.html#donate" class="nav-donate nav-donate-desktop">Give</a>
				<a href="admin-login.html" class="nav-admin" aria-label="Admin">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
				</a>
			</div>
			<button class="hamburger" onclick="toggleMenu()" aria-label="Menu">
				<span></span><span></span><span></span>
			</button>
		</nav>

		<section class="events-page-hero">
			<div class="section-inner">
				<div class="section-label">Mark Your Calendar</div>
				<h1 class="section-title" style="font-size:clamp(2rem, 5vw, 3.5rem);">Events</h1>
				<p style="max-width:650px; line-height:1.8; color:var(--text);">See what's coming up at Sons of Thunder Ministry &#8212; services, outreach, and community gatherings.</p>
			</div>
		</section>

		<section class="events-list-section">
			<div class="section-inner">
				<div class="events-list" id="eventsUpcomingList">
					<p class="events-empty">Loading…</p>
				</div>

				<div class="events-past-wrap" id="eventsPastWrap">
					<button type="button" class="events-past-toggle" id="eventsPastToggle">Show past events</button>
					<div class="events-list events-past-list" id="eventsPastList"></div>
				</div>
			</div>
		</section>

		<footer>
			<div class="footer-logo">Sons of Thunder Ministry</div>
			<p class="footer-tagline">"Lifting up the name of Jesus one lap at a time"</p>
			<ul class="footer-links">
				<li><a href="index.html#about">About</a></li>
				<li><a href="index.html#ministries">Ministries</a></li>
				<li><a href="index.html#message">Message</a></li>
				<li><a href="events.html">Events</a></li>
				<li><a href="index.html#board">Board</a></li>
				<li><a href="index.html#sermons">Sermons</a></li>
				<li><a href="index.html#donate">Donate</a></li>
				<li><a href="https://www.youtube.com/@hughcompton4575" target="_blank" data-setting-link="youtube_url">YouTube</a></li>
			</ul>
			<div class="footer-bottom">
				<p>Sons of Thunder Ministry, Inc. &nbsp;&#183;&nbsp; Mooresville, NC &nbsp;&#183;&nbsp; 501(c)(3) EIN 20-0522987</p>
				<p style="margin-top:0.4rem;">Made by <a href="https://developerofcode.com" target="_blank">Developer of Code, LLC</a></p>
			</div>
		</footer>

		<script>
			function toggleMenu() { document.getElementById('navLinks').classList.toggle('open'); }
			function closeMenu() { document.getElementById('navLinks').classList.remove('open'); }
		</script>
		<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
		<script src="js/supabase-client.js"></script>
		<script src="js/site-settings-loader.js"></script>
		<script src="js/events.js"></script>
		<script src="js/events-page.js"></script>
		<script>
			EventsPage.renderEventsPage();
		</script>
	</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add events.html
git commit -m "feat(events): add public events.html page"
```

(Styling and end-to-end verification happen in Tasks 9–10.)

---

### Task 8: Homepage — nav link, events section, script load

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the nav link**

In `index.html`, inside `#navLinks` (around line 18–26), add a new `<li>` between the Message and Board items:

```html
<li><a href="events.html" onclick="closeMenu()">Events</a></li>
```

So the list reads: About, Ministries, Message, **Events**, Board, Sermons, Give, Admin.

- [ ] **Step 2: Insert the homepage events section**

Find the end of the Message section (`<section class="message-section" id="message">` … `</section>` — closing around line 143 per the earlier read). Immediately after its closing `</section>`, before `<section class="board-section" id="board">`, insert:

```html
<section class="events-section" id="events">
	<div class="section-inner">
		<div class="section-label reveal" style="justify-content:center">What's Coming Up</div>
		<h2 class="section-title reveal delay-1" style="text-align:center">Upcoming Events</h2>
		<div class="events-preview-list reveal delay-2"></div>
		<div class="reveal delay-3" style="text-align:center; margin-top:2rem;">
			<a href="events.html" class="btn-primary" style="font-size:0.8rem; padding:1rem 3rem;">View All Events</a>
		</div>
	</div>
</section>
```

- [ ] **Step 3: Load the event scripts and trigger the preview**

Scroll to the bottom of `index.html`, find the existing `<script>` tags. Add these two new script tags in the existing script-loading area (near `site-settings-loader.js` if present, otherwise just before the closing `</body>`):

```html
<script src="js/events.js"></script>
<script src="js/events-page.js"></script>
```

Then add an inline trigger — pick a spot immediately after those two script tags:

```html
<script>
	EventsPage.renderHomepagePreview();
</script>
```

- [ ] **Step 4: Link the events stylesheet**

In the `<head>` of `index.html`, add after the existing stylesheet links:

```html
<link rel="stylesheet" href="css/events.css">
```

- [ ] **Step 5: Verify in the browser**

Open `index.html` (or whatever your local dev URL is) with **no events** in the DB. Scroll past Message section.

Expected: no `#events` section is visible — it's hidden because there are no upcoming events.

Now add two future-dated events via the admin. Reload the homepage.

Expected: an "Upcoming Events" section appears with those two events as unstyled cards (styling arrives in Task 10 — card structure should still be visible). The "View All Events" button links to `events.html`. Visiting `events.html` shows the same two events and a "Show past events" toggle.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(events): add homepage preview section and nav link"
```

---

### Task 9: Nav + footer link consistency on existing sub-pages

**Files:**
- Modify: `sermons.html`
- Modify: `chariots-for-jesus.html`
- Modify: `fuel-for-the-soul.html`

- [ ] **Step 1: Add the Events nav link to every sub-page**

In each of `sermons.html`, `chariots-for-jesus.html`, and `fuel-for-the-soul.html`, find the `#navLinks` `<ul>` and insert the Events link between Message and Board (matching `index.html`):

```html
<li><a href="events.html" onclick="closeMenu()">Events</a></li>
```

- [ ] **Step 2: Add the Events footer link to every sub-page**

In the same three files, find the `<ul class="footer-links">` block and insert an Events link between the Message and Board items:

```html
<li><a href="events.html">Events</a></li>
```

- [ ] **Step 3: Verify in the browser**

Load each of `sermons.html`, `chariots-for-jesus.html`, and `fuel-for-the-soul.html`. Confirm the Events link appears in both the nav and the footer on each, and clicking it navigates to `events.html`.

- [ ] **Step 4: Commit**

```bash
git add sermons.html chariots-for-jesus.html fuel-for-the-soul.html
git commit -m "feat(events): add Events nav and footer links across sub-pages"
```

---

### Task 10: Public event card styles

**Files:**
- Create: `css/events.css`

- [ ] **Step 1: Create the stylesheet**

Create `css/events.css`:

```css
/* =============================================
   EVENTS.CSS — Public homepage preview + events.html
   ============================================= */

/* ---- Homepage preview section ---- */
.events-section {
	padding: 6rem 0;
	background: var(--bg-alt, #0f0f12);
}
.events-section .section-inner {
	max-width: 1000px;
	margin: 0 auto;
}
.events-preview-list {
	display: grid;
	gap: 1.25rem;
	margin-top: 3rem;
	grid-template-columns: 1fr;
}
@media (min-width: 720px) {
	.events-preview-list {
		grid-template-columns: repeat(2, 1fr);
	}
}
@media (min-width: 1000px) {
	.events-preview-list {
		grid-template-columns: repeat(3, 1fr);
	}
}

/* ---- Events page ---- */
.events-page-hero {
	padding: 9rem 0 3rem;
	text-align: left;
	background: var(--bg, #0a0a0d);
}
.events-list-section {
	padding: 2rem 0 6rem;
	background: var(--bg, #0a0a0d);
}
.events-list {
	display: grid;
	gap: 1.25rem;
	grid-template-columns: 1fr;
}
@media (min-width: 720px) {
	.events-list {
		grid-template-columns: repeat(2, 1fr);
	}
}

.events-empty {
	text-align: center;
	color: var(--text-muted);
	font-style: italic;
	padding: 3rem 1rem;
}

.events-past-wrap {
	margin-top: 3rem;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	padding-top: 2rem;
}
.events-past-toggle {
	display: block;
	margin: 0 auto 1.5rem;
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.25);
	color: var(--text);
	padding: 0.7rem 1.6rem;
	font-family: 'Cinzel', serif;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	font-size: 0.75rem;
	cursor: pointer;
	transition: border-color 0.2s, color 0.2s;
}
.events-past-toggle:hover {
	border-color: var(--gold);
	color: var(--gold);
}
.events-past-list {
	display: none;
	opacity: 0.65;
}
.events-past-wrap.is-open .events-past-list {
	display: grid;
}

/* ---- Event card ---- */
.event-card {
	display: flex;
	gap: 1.2rem;
	padding: 1.4rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 8px;
	transition: border-color 0.25s, transform 0.25s;
}
.event-card:hover {
	border-color: var(--gold);
	transform: translateY(-2px);
}

.event-card-badge {
	flex-shrink: 0;
	width: 72px;
	height: 72px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: var(--gold);
	color: #111;
	border-radius: 6px;
	font-family: 'Cinzel', serif;
	line-height: 1;
}
.event-card-badge-month {
	font-size: 0.75rem;
	letter-spacing: 0.15em;
	font-weight: 700;
	margin-bottom: 0.3rem;
}
.event-card-badge-day {
	font-size: 1.75rem;
	font-weight: 700;
}

.event-card-body {
	flex: 1;
	min-width: 0;
}
.event-card-title {
	font-family: 'Cinzel', serif;
	font-size: 1.15rem;
	margin: 0 0 0.4rem;
	color: var(--text);
	line-height: 1.3;
}
.event-card-meta {
	font-size: 0.82rem;
	color: var(--gold-light, var(--gold));
	letter-spacing: 0.02em;
	margin-bottom: 0.6rem;
}
.event-card-desc {
	font-size: 0.9rem;
	line-height: 1.6;
	color: var(--text-muted);
	margin-bottom: 0.8rem;
}
.event-card-desc-clamp {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.event-card-desc p:first-child { margin-top: 0; }
.event-card-desc p:last-child  { margin-bottom: 0; }

.event-card-link {
	display: inline-block;
	font-family: 'Cinzel', serif;
	font-size: 0.75rem;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--gold);
	text-decoration: none;
	border-bottom: 1px solid currentColor;
	padding-bottom: 2px;
	transition: color 0.2s;
}
.event-card-link:hover {
	color: var(--gold-light, #fff);
}
```

- [ ] **Step 2: Verify in the browser**

With 3+ upcoming events in the DB, reload the homepage and `events.html`.

Verify:
- Cards have a gold date badge on the left (month abbreviation + day number).
- Title, meta line (date · time · location), short description, optional "More Info" link stack to the right.
- Homepage preview shows up to 3 cards, wrapping to 2 columns on tablet and 3 on desktop.
- Events page shows cards in 2 columns on tablet+. "Show past events" toggle flips to "Hide past events" when clicked and reveals past events at reduced opacity.
- Hover on a card: gold border + slight lift.

- [ ] **Step 3: Commit**

```bash
git add css/events.css
git commit -m "style(events): public event cards and events page layout"
```

---

### Task 11: End-to-end verification pass

**Files:** none

- [ ] **Step 1: Scenario matrix**

Walk through each row against a live site (reload between runs to force fresh fetches):

| # | Scenario | Expected |
|---|---|---|
| 1 | No events in DB, load homepage | `#events` section not visible |
| 2 | No events in DB, load `events.html` | "No upcoming events right now. Check back soon." shown |
| 3 | 1 event today, load homepage | event appears under Upcoming (today counts as upcoming) |
| 4 | 1 event yesterday, load homepage | `#events` hidden; on `events.html` it appears only when "Show past events" is expanded |
| 5 | 5 events all in the future, load homepage | only 3 nearest shown; all 5 shown on `events.html` |
| 6 | Event with only start time | meta reads e.g. "Fri, May 15, 2026 · 7:00 PM · …" |
| 7 | Event with no start and no end time | meta reads e.g. "Fri, May 15, 2026 · All day · …" |
| 8 | Event with `linkUrl` | "More Info" button appears and opens in a new tab |
| 9 | Admin edits an event | public pages reflect the change on next reload |
| 10 | Admin deletes an event | event disappears from homepage and events page on next reload |
| 11 | Visit Events nav link from every sub-page | navigates to `events.html` |

- [ ] **Step 2: RLS sanity check**

In a private/incognito window (not logged into admin), open the browser console on `events.html` and attempt:

```javascript
sb.from('events').insert({ title: 'pwned', event_date: '2099-01-01' }).then(console.log)
```

Expected: `res.error` is populated (row-level security violation). No row is inserted.

- [ ] **Step 3: Timezone boundary check**

Late in the evening (after ~8 PM ET), set your OS clock to UTC and reload. Events dated "today" in America/New_York should still appear as upcoming — `Events.todayNY()` must use the New York date, not UTC. If a today-event disappears past midnight UTC but before midnight ET, the timezone handling is broken and needs a fix before shipping.

- [ ] **Step 4: Final commit (if any fixes were needed)**

If any scenarios failed and required fixes, commit them:

```bash
git add -A
git commit -m "fix(events): address issues found during end-to-end verification"
```

If nothing needed fixing, there's nothing to commit for this task.

---

## Done

When all tasks above are complete and verified, the feature is shippable. Deploy by merging to the main branch (or however this site is deployed — no build step is required).
