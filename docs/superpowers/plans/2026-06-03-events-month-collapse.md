# Collapsible Months Under Past-Event Years — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the months inside an opened past-event year collapsible, with the newest month auto-expanded so users immediately see content.

**Architecture:** Mirror the existing year-level collapse pattern one level deeper. Update markup in `pastGroupedHtml()` so each month renders as a button-driven `.events-month-group(.open)` with animated content; add matching CSS (lighter visual weight than the year heading); extend the existing pastList click handler so clicks on month headings toggle the parent group, and so opening a year auto-opens its newest month when none is already open.

**Tech Stack:** Vanilla JS (IIFE module pattern, no framework), CSS animations via `grid-template-rows` 0fr → 1fr, no test runner — verification is manual via local HTTP server + browser.

**Spec:** [docs/superpowers/specs/2026-06-03-events-month-collapse-design.md](../specs/2026-06-03-events-month-collapse-design.md)

---

## File Structure

- Modify: [js/events-page.js](../../../js/events-page.js)
  - `pastGroupedHtml()` (lines 83–100): change per-month markup to collapsible group
  - `renderEventsPage()` (lines 148–155): extend pastList click handler with month toggle + auto-open-newest logic
- Modify: [css/events.css](../../../css/events.css)
  - Replace existing `.events-month-heading` / `.events-month-group .events-list` block (lines 159–169) with collapsible month styles

No new files. No test files (project has no test framework — verification is by running the local server and clicking through the events page).

---

## Task 1: Update Past-Month Markup to Collapsible Groups

**Files:**
- Modify: `js/events-page.js:83-100` (`pastGroupedHtml` function)

- [ ] **Step 1: Replace `pastGroupedHtml` with the collapsible-month version**

Edit [js/events-page.js](../../../js/events-page.js) — replace the existing `pastGroupedHtml` function (lines 83–100) with:

```javascript
	function pastGroupedHtml(events) {
		return groupByYearMonth(events).map(function (yObj) {
			var monthsHtml = yObj.months.map(function (m) {
				return '<div class="events-month-group">'
					+ '<button type="button" class="events-month-heading" aria-expanded="false">'
					+ '<span class="events-month-arrow"></span>' + m.label
					+ '</button>'
					+ '<div class="events-month-content"><div class="events-month-content-inner">'
					+ '<div class="events-list">'
					+ m.events.map(function (e) { return cardHtml(e, 'full'); }).join('')
					+ '</div>'
					+ '</div></div>'
					+ '</div>';
			}).join('');
			return '<div class="events-year-group">'
				+ '<button type="button" class="events-year-heading" aria-expanded="false">'
				+ '<span class="events-year-arrow"></span>' + yObj.year
				+ '</button>'
				+ '<div class="events-year-content"><div class="events-year-content-inner">' + monthsHtml + '</div></div>'
				+ '</div>';
		}).join('');
	}
```

The year-level structure is unchanged. Only the month fragment changed: from `<h4>` + sibling `.events-list` → `<button>` + `.events-month-content` > `.events-month-content-inner` > `.events-list`.

- [ ] **Step 2: Verify markup compiles (no JS syntax error)**

Run a syntax sanity-check via node:

```bash
node --check js/events-page.js
```

Expected: no output, exit code 0. If there's a syntax error, fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add js/events-page.js
git commit -m "Render past-event months as collapsible groups"
```

---

## Task 2: Add Month-Level CSS

**Files:**
- Modify: `css/events.css:159-169` (replace the existing `.events-month-heading` / `.events-month-group .events-list` block)

- [ ] **Step 1: Replace the month CSS block**

In [css/events.css](../../../css/events.css), find this existing block (lines 159–169):

```css
.events-month-heading {
	font-family: 'Cinzel', serif;
	font-size: 0.85rem;
	text-transform: uppercase;
	letter-spacing: 0.15em;
	color: var(--text-muted);
	margin: 1.25rem 0 0.85rem;
}
.events-month-group .events-list {
	display: grid;
}
```

Replace it with the collapsible-month styles (button heading + arrow + animated content, scaled smaller than the year toggle):

```css
.events-month-group + .events-month-group {
	margin-top: 0.25rem;
}
.events-month-heading {
	display: flex;
	align-items: center;
	gap: 0.55rem;
	width: 100%;
	padding: 0.65rem 0;
	background: none;
	border: none;
	cursor: pointer;
	text-align: left;
	font-family: 'Cinzel', serif;
	font-size: 0.85rem;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.15em;
	color: var(--text-muted);
	transition: color 0.2s;
}
.events-month-heading:hover {
	color: var(--gold);
}
.events-month-arrow {
	display: inline-block;
	width: 0;
	height: 0;
	border-top: 4px solid transparent;
	border-bottom: 4px solid transparent;
	border-left: 6px solid currentColor;
	transition: transform 0.25s ease;
	flex-shrink: 0;
}
.events-month-group.open .events-month-arrow {
	transform: rotate(90deg);
}
.events-month-content {
	display: grid;
	grid-template-rows: 0fr;
	transition: grid-template-rows 0.3s ease;
}
.events-month-group.open .events-month-content {
	grid-template-rows: 1fr;
}
.events-month-content-inner {
	min-height: 0;
	overflow: hidden;
}
.events-month-group.open .events-month-content-inner {
	padding-bottom: 0.75rem;
}
.events-month-group .events-list {
	display: grid;
}
@media (prefers-reduced-motion: reduce) {
	.events-month-content {
		transition: none;
	}
}
```

This mirrors the `.events-year-*` pattern with these intentional visual differences: smaller chevron (6px vs 7px), lighter font weight (500 vs 700), tighter padding (0.65rem vs 1rem), no top border between months, hover lifts color to `--gold` (year is gold by default and lightens on hover).

- [ ] **Step 2: Commit**

```bash
git add css/events.css
git commit -m "Style collapsible month groups on Events page"
```

---

## Task 3: Wire Up Month Toggle and Auto-Open-Newest

**Files:**
- Modify: `js/events-page.js:148-155` (the delegated click handler inside `renderEventsPage`)

- [ ] **Step 1: Replace the year-only click handler with combined year + month logic**

In [js/events-page.js](../../../js/events-page.js), find the existing delegated handler attached after past events render (lines 148–155):

```javascript
						// Collapse/expand a year group when its heading is clicked.
						pastList.addEventListener('click', function (ev) {
							var btn = ev.target.closest('.events-year-heading');
							if (!btn) return;
							var group = btn.parentNode;
							var isOpen = group.classList.toggle('open');
							btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
						});
```

Replace it with this expanded handler that also toggles months and auto-opens the newest month when a year opens:

```javascript
						// Collapse/expand year and month groups when their headings are clicked.
						pastList.addEventListener('click', function (ev) {
							var yearBtn = ev.target.closest('.events-year-heading');
							if (yearBtn) {
								var yearGroup = yearBtn.parentNode;
								var yearOpen = yearGroup.classList.toggle('open');
								yearBtn.setAttribute('aria-expanded', yearOpen ? 'true' : 'false');

								// When a year opens and none of its months are already
								// open, auto-open the newest (first) month so the user
								// immediately sees content.
								if (yearOpen) {
									var monthGroups = yearGroup.querySelectorAll('.events-month-group');
									var anyOpen = yearGroup.querySelector('.events-month-group.open');
									if (monthGroups.length && !anyOpen) {
										monthGroups[0].classList.add('open');
										var firstBtn = monthGroups[0].querySelector('.events-month-heading');
										if (firstBtn) firstBtn.setAttribute('aria-expanded', 'true');
									}
								}
								return;
							}

							var monthBtn = ev.target.closest('.events-month-heading');
							if (monthBtn) {
								var monthGroup = monthBtn.parentNode;
								var monthOpen = monthGroup.classList.toggle('open');
								monthBtn.setAttribute('aria-expanded', monthOpen ? 'true' : 'false');
							}
						});
```

Key points: year handler returns early after handling so we never accidentally hit the month branch on the same click; auto-open only fires when no month in that year is already open, so a user who manually opened/closed months keeps control.

- [ ] **Step 2: Verify the file still parses**

```bash
node --check js/events-page.js
```

Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add js/events-page.js
git commit -m "Add month toggle and auto-open newest month on year expand"
```

---

## Task 4: Manual Browser Verification

**Files:** None modified — this task is purely verification.

- [ ] **Step 1: Start a local server**

From the repo root:

```bash
python3 -m http.server 8000
```

Leave it running. (Any static server works — `npx serve`, `php -S localhost:8000`, etc.)

- [ ] **Step 2: Open the Events page**

Navigate to `http://localhost:8000/events.html` in a browser.

- [ ] **Step 3: Verify golden-path behavior**

Click "Show past events". Then for each scenario below, confirm the expected result:

| Action | Expected |
|---|---|
| Click year "2026" (closed) | Year expands. The newest month inside (whichever month is first in the list) is auto-expanded with its event cards visible. Older months show as collapsed headings with a right-pointing chevron. |
| Click an older month inside the opened year | Month expands smoothly with the same animation feel as the year toggle. Chevron rotates 90°. |
| Click the same month again | Month collapses. Chevron rotates back. |
| Click the year heading again | Year collapses (months inside don't matter for the year-level state). |
| Re-click the same year | Year re-opens. Newest month auto-opens again **only if** no month inside it is currently marked open. |
| Tab through with the keyboard | Both year buttons and month buttons receive focus and can be activated with Enter / Space. |

- [ ] **Step 4: Verify no regression on adjacent features**

| Check | Expected |
|---|---|
| Upcoming events section above past events | Unchanged — cards render the same as before. |
| Homepage events preview (`/index.html` → "Events" section) | Unchanged — still shows up to 3 upcoming events. |
| "Hide past events" toggle | Still hides the whole past-events list. |
| Multiple years (e.g., 2026 and 2025) | Each year toggles independently. Opening 2025 does not affect 2026's state. |

- [ ] **Step 5: Verify accessibility**

Open DevTools → Elements. Click open a year, then click open a month. Confirm:

- The year button has `aria-expanded="true"` when open, `"false"` when closed.
- The month button has `aria-expanded="true"` when open, `"false"` when closed.
- Both are real `<button type="button">` elements.

- [ ] **Step 6: Stop the local server**

`Ctrl+C` in the terminal running the server.

- [ ] **Step 7: If everything passes, no commit needed — work is done.**

If a check fails, return to the relevant earlier task, fix, recommit, and re-verify.

---

## Done

After Task 4 completes cleanly, the feature is live on `main`. No remaining follow-ups.
