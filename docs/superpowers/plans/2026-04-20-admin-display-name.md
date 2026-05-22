# Admin Display Name + View-Site New Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each admin set a display name (stored in Supabase `user_metadata`), show a "Hi, <name>" greeting in the dashboard top bar, echo the name alongside the email in Settings, and make the "View Site" link open in a new tab.

**Architecture:** Three surfaces change in a specific order so each commit is independently sensible. (1) The `Auth` module in [js/auth.js](../../../js/auth.js) gains three small helpers — `rawDisplayName`, `displayName`, `updateDisplayName` — that wrap `supabase.auth.updateUser({ data: { display_name } })`. (2) The "View Site" anchor in [admin-dashboard.html](../../../admin-dashboard.html) gets `target="_blank" rel="noopener noreferrer"`. (3) The top bar gets a new `<span class="admin-greeting">` styled via a new rule in [css/admin.css](../../../css/admin.css). (4) A new "Display Name" settings section plus a dispatch branch in the `.btn-save-section` loop pre-fills the input, persists the value, and re-renders both the top-bar greeting and the "Signed in as" line.

**Tech Stack:** Vanilla HTML/JS, `@supabase/supabase-js` (already loaded), existing `Auth` module, existing CSS design tokens (`--text-muted`, `--gold`, Cinzel font).

**Spec:** [docs/superpowers/specs/2026-04-20-admin-display-name-design.md](../specs/2026-04-20-admin-display-name-design.md)

**Note on testing:** No JS test framework in this project (`npm test` errors; `package.json` has only puppeteer for PDF generation). Verification is manual, in-browser, following the spec's Testing section.

---

## File Structure

**Modified:**
- [js/auth.js](../../../js/auth.js) — add `rawDisplayName`, `displayName`, `updateDisplayName` (≈25 lines total).
- [admin-dashboard.html](../../../admin-dashboard.html) — add `target="_blank" rel="noopener noreferrer"` on View Site (1 line), add `<span class="admin-greeting">` in `.admin-topbar-right` (1 line), add new Display Name `<section>` in Settings tab (≈10 lines), add dispatch branch + init wiring in the inline script (≈25 lines).
- [css/admin.css](../../../css/admin.css) — add `.admin-greeting` rule (≈6 lines).

**Unchanged:** `js/supabase-client.js`, all RLS, all other `js/*.js` modules, all other HTML pages.

---

### Task 1: Add `rawDisplayName`, `displayName`, `updateDisplayName` to `Auth` module

**Files:**
- Modify: `js/auth.js`

- [ ] **Step 1: Read the current module**

Open [js/auth.js](../../../js/auth.js) (only 83 lines). Note the module shape: an IIFE that exposes named functions via a final return object. Session is cached in `_session` and is populated by `getSession()` / `login()`.

- [ ] **Step 2: Add the three helpers**

Insert the three new functions **after** `sendPasswordReset` (line 70 region) and **before** the final `return { ... }` object (line 72 region). Exact code (use tabs, matching the file's existing indentation):

```js
	function rawDisplayName() {
		if (!_session || !_session.user) return null;
		var name = _session.user.user_metadata && _session.user.user_metadata.display_name;
		return (typeof name === 'string' && name.length > 0) ? name : null;
	}

	function displayName() {
		if (!_session || !_session.user) return null;
		var raw = rawDisplayName();
		if (raw) return raw;
		var email = _session.user.email || '';
		var at = email.indexOf('@');
		if (at > 0) {
			var local = email.slice(0, at);
			return local.charAt(0).toUpperCase() + local.slice(1);
		}
		return email || null;
	}

	function updateDisplayName(name) {
		var trimmed = (name || '').trim();
		var value = trimmed.length > 0 ? trimmed : null;
		return sb.auth.updateUser({ data: { display_name: value } })
			.then(function (res) {
				if (res.error) return { ok: false, error: res.error.message };
				if (res.data && res.data.user) {
					if (_session) _session.user = res.data.user;
				}
				return { ok: true };
			});
	}
```

Notes:
- `rawDisplayName()` treats a non-string or empty-string as "no name set" (returns `null`) — matches the spec.
- `displayName()` uppercases only the first character of the email local part; if the email lacks `@` (extremely unlikely — Supabase validates) it returns the whole email.
- `updateDisplayName()` persists `null` for empty/whitespace input, which Supabase treats as "clear this key."
- The `_session.user = res.data.user` assignment is critical — without re-hydration, `rawDisplayName()` would return the stale value immediately after a save.

- [ ] **Step 3: Export the new functions**

Update the final `return { ... }` object (lines 72–81 region) to include the three new functions. After the edit it should read:

```js
	return {
		getSession: getSession,
		isLoggedIn: isLoggedIn,
		currentUserEmail: currentUserEmail,
		login: login,
		logout: logout,
		requireAuth: requireAuth,
		changePassword: changePassword,
		sendPasswordReset: sendPasswordReset,
		rawDisplayName: rawDisplayName,
		displayName: displayName,
		updateDisplayName: updateDisplayName
	};
```

- [ ] **Step 4: Smoke-test from the browser console**

Serve the directory and open the dashboard while logged in (`http://localhost:8080/admin-dashboard.html`). In the browser DevTools console:

```js
Auth.rawDisplayName()   // expect: null (no name set yet)
Auth.displayName()      // expect: capitalized email local part, e.g. "Pastor"
Auth.updateDisplayName('Test Name').then(console.log)  // expect: { ok: true }
Auth.rawDisplayName()   // expect: "Test Name"
Auth.displayName()      // expect: "Test Name"
Auth.updateDisplayName('').then(console.log)  // expect: { ok: true }
Auth.rawDisplayName()   // expect: null
```

If you don't have a browser available, skip this and instead verify structurally: the three functions are defined, they are listed in the return object, no syntax errors (try `node -c js/auth.js` — this *won't* run the module because it references browser globals like `sb`, but it will catch parse errors).

Run: `node -c js/auth.js`
Expected: no output (success). Any output indicates a syntax error.

- [ ] **Step 5: Commit**

```bash
git add js/auth.js
git commit -m "feat(auth): add display name helpers (raw/fallback/update)"
```

---

### Task 2: Make "View Site" open in a new tab

**Files:**
- Modify: `admin-dashboard.html` (one line in the top bar)

- [ ] **Step 1: Locate the View Site anchor**

In [admin-dashboard.html](../../../admin-dashboard.html), line 25:

```html
<a href="index.html" class="btn-logout">View Site</a>
```

- [ ] **Step 2: Add `target` and `rel` attributes**

Replace with:

```html
<a href="index.html" class="btn-logout" target="_blank" rel="noopener noreferrer">View Site</a>
```

`rel="noopener noreferrer"` prevents the newly-opened tab from accessing `window.opener` (standard tabnabbing hardening — low risk at same origin, but it's free).

- [ ] **Step 3: Verify in browser**

Reload the dashboard, click "View Site". The public site should open in a **new tab**, and the dashboard tab should remain unchanged (still on whatever tab of the dashboard was active). Close the new tab. Return to the dashboard — confirm no logout occurred, no scroll position was lost.

If no browser is available, verify structurally with `grep -n 'View Site' admin-dashboard.html` — should show the single line with both `target="_blank"` and `rel="noopener noreferrer"` attributes.

- [ ] **Step 4: Commit**

```bash
git add admin-dashboard.html
git commit -m "feat(admin): open View Site link in a new tab"
```

---

### Task 3: Add the top-bar greeting element and its CSS

**Files:**
- Modify: `admin-dashboard.html` (insert `<span>` in `.admin-topbar-right`)
- Modify: `css/admin.css` (add `.admin-greeting` rule)

- [ ] **Step 1: Insert the greeting span**

In [admin-dashboard.html](../../../admin-dashboard.html), inside the `.admin-topbar-right` `<div>` (current lines 24–27), insert a new `<span>` **before** the View Site anchor:

```html
				<div class="admin-topbar-right">
					<span class="admin-greeting" id="adminGreeting" aria-live="polite"></span>
					<a href="index.html" class="btn-logout" target="_blank" rel="noopener noreferrer">View Site</a>
					<button class="btn-logout" id="logoutBtn">Logout</button>
				</div>
```

Tabs, 5 levels deep (matching the surrounding elements).

The element starts empty. Task 4 adds the init code that populates it. On its own, Task 3 just reserves the slot with zero visual change until the user has a session and Task 4 ships.

- [ ] **Step 2: Add the CSS rule**

In [css/admin.css](../../../css/admin.css), add a new rule **after** the existing `.admin-topbar-right .btn-logout:hover` block (ends at line 319) and **before** the `.dashboard-body` rule (starts at line 321):

```css
.admin-topbar-right .admin-greeting {
	font-family: 'Cinzel', serif;
	font-size: 0.7rem;
	letter-spacing: 0.12em;
	color: var(--text-muted);
	white-space: nowrap;
}

.admin-topbar-right .admin-greeting:empty {
	display: none;
}
```

Why these values:
- `font-family` / `letter-spacing` / `color` match the adjacent `.btn-logout` typography for visual coherence.
- `font-size: 0.7rem` is slightly larger than the buttons' `0.65rem` so the name reads as content rather than a UI control, but stays subtle.
- No `text-transform` — admin names should render as typed ("Pastor Hugh", not "PASTOR HUGH").
- No border / padding — the span is text, not a button.
- `:empty { display: none }` hides the element cleanly until Task 4's JS populates it.

- [ ] **Step 3: Verify layout in browser**

Reload the dashboard. The top-right should still show **only** "View Site" and "Logout" buttons (the greeting span is empty until Task 4). Confirm no layout shift, no stray whitespace, no gap where the empty span lives. Task 3's CSS `:empty` rule should fully collapse it.

If no browser is available: verify `grep -n admin-greeting css/admin.css admin-dashboard.html` shows the expected insertions with `:empty { display: none }` present.

- [ ] **Step 4: Commit**

```bash
git add admin-dashboard.html css/admin.css
git commit -m "feat(admin): add empty greeting slot to topbar with matching styles"
```

---

### Task 4: Display Name settings section, dispatch branch, and init wiring

**Files:**
- Modify: `admin-dashboard.html` (add `<section>` in Settings tab, add dispatch branch in `.btn-save-section` click loop, add init code to populate greeting / pre-fill input / render "Signed in as")

This task is the largest. It ties everything together.

- [ ] **Step 1: Add the Display Name settings section**

In [admin-dashboard.html](../../../admin-dashboard.html), inside `#tab-settings > .settings-stack`, find the existing "Account" section (ends with `<button ... data-section="account">Update Password</button></section>`). **Immediately after** that closing `</section>` and **before** the `<!-- Admin Password Recovery -->` block, insert:

```html

						<!-- Display Name -->
						<section class="settings-section">
							<h2>Display Name</h2>
							<div class="form-group">
								<label for="displayNameInput">Your name</label>
								<input type="text" id="displayNameInput" autocomplete="name" placeholder="e.g. Pastor Hugh">
							</div>
							<p class="settings-hint">Shown in the top bar when you're signed in. Leave blank to display your email instead.</p>
							<button class="btn-save-section" data-section="displayname">Save Display Name</button>
						</section>
```

Tabs, matching the Account / Admin Password Recovery sections' depth (5 tabs for `<section>`, 6 for inner elements, 7 for form-group children).

`data-section="displayname"` (one word, no separator) mirrors the existing `account`, `contact`, `social`, `donation`, `verse`, `recovery` naming pattern.

- [ ] **Step 2: Add the dispatch branch in the click loop**

In the inline `<script>` inside `initDashboard()`, find the `.btn-save-section` click handler — specifically the `if (section === 'recovery') { ... }` block (added in a prior commit). Insert a new branch **after** `if (section === 'recovery') { ... return; }` and **before** the generic `Settings.update(collectSection(section))...` call:

```js
						if (section === 'displayname') {
							var displayNameInput = document.getElementById('displayNameInput');
							Auth.updateDisplayName(displayNameInput.value).then(function (res) {
								if (res.ok) {
									renderAccountIdentity();
									showToast('Display name saved');
								} else {
									showToast(res.error || 'Could not save display name', 'error');
								}
								done();
							});
							return;
						}
```

Tabs, matching the surrounding `if (section === 'recovery')` block's indentation (7 tabs).

The `return` at the end is critical — same reason as the `recovery` and `account` branches: prevents the generic `Settings.update(collectSection(section))` path from crashing on an undefined `SECTIONS.displayname`.

`renderAccountIdentity` is a new helper defined in Step 3 — it refreshes the top-bar greeting AND the "Signed in as" line in one call.

- [ ] **Step 3: Add `renderAccountIdentity` and initial render in `initDashboard()`**

Still in the inline script inside `initDashboard()`, find the existing "Settings" block which begins:

```js
					// ---- Settings ----
					var accountEmailEl = document.getElementById('accountEmail');
					accountEmailEl.textContent = Auth.currentUserEmail() || '—';
```

**Replace those three lines** with:

```js
					// ---- Settings ----
					var accountEmailEl = document.getElementById('accountEmail');
					var adminGreetingEl = document.getElementById('adminGreeting');
					var displayNameInput = document.getElementById('displayNameInput');

					function renderAccountIdentity() {
						var email = Auth.currentUserEmail() || '';
						var raw = Auth.rawDisplayName();
						accountEmailEl.textContent = raw ? (raw + ' (' + email + ')') : (email || '—');
						var greet = Auth.displayName();
						adminGreetingEl.textContent = greet ? ('Hi, ' + greet) : '';
						displayNameInput.value = raw || '';
					}
					renderAccountIdentity();
```

The pre-fill of the input uses `raw` (the actual stored value), not the email-local-part fallback — the spec explicitly requires this so users who have never set a name see an empty field, not their auto-capitalized email.

The greeting uses `Auth.displayName()` (the fallback), so even a user who has never set a name sees a friendly-looking greeting.

- [ ] **Step 4: Verify each behavior in the browser**

Serve the directory and open the dashboard. Log in.

Checks (all in the logged-in dashboard):

1. **No name set (fresh user):** Top bar shows `"Hi, <Emaillocalpart>"` (first letter capitalized). Settings → Account shows "Signed in as: <email>" only. Settings → Display Name input is empty.
2. **Set a name:** In Settings → Display Name, type `"Pastor Hugh"`, click Save. Expect a green toast `"Display name saved"`. Top bar updates to `"Hi, Pastor Hugh"` without reload. "Signed in as" updates to `"Pastor Hugh (pastor@…)"` without reload.
3. **Reload:** After reload, all three places still show the saved name.
4. **Whitespace-only name:** Enter `"   "`, click Save. Expect `"Display name saved"` toast; top bar reverts to email-local-part fallback; input field is now empty on the next render.
5. **Error path:** Temporarily disconnect network (DevTools → Offline), enter a valid name, click Save. Expect red error toast. Button re-enables.
6. **Cross-account isolation:** Log out, log in as the other admin account. Expect their own (possibly empty) display name, not the first account's. Setting a name here does not affect the first account.

If no browser is available, verify structurally:
- `grep -n renderAccountIdentity admin-dashboard.html` — should show the function definition and one call inside `initDashboard()` and one call inside the `displayname` branch.
- Confirm the `if (section === 'displayname')` branch sits between the `recovery` branch and the `Settings.update(collectSection(section))` line.

- [ ] **Step 5: Commit**

```bash
git add admin-dashboard.html
git commit -m "feat(admin): display-name settings section, topbar greeting, Signed in as"
```

---

## Self-Review

**Spec coverage:**
- §1 Storage (`user_metadata.display_name`) → Task 1 (`updateDisplayName` writes it, `rawDisplayName` reads it) ✓
- §2 `js/auth.js` additions (`rawDisplayName`, `displayName`, `updateDisplayName`) → Task 1 Steps 2–3 ✓
- §3 Top-bar greeting (element + `aria-live` + `Hi, <name>`) → Task 3 Step 1 (element), Task 4 Step 3 (populate) ✓
- §3 CSS rule (matches `.btn-logout` typography) → Task 3 Step 2 ✓
- §4 Settings section (exact markup incl. `autocomplete="name"` and the hint text) → Task 4 Step 1 ✓
- §4 Dispatch branch (calls `Auth.updateDisplayName`, calls `renderAccountIdentity`, toasts) → Task 4 Step 2 ✓
- §4 Input pre-fill with `rawDisplayName()` → Task 4 Step 3 ✓
- §5 "Signed in as" render update (`<raw> (<email>)` or `<email>`) → Task 4 Step 3 ✓
- §6 View Site → new tab → Task 2 ✓

**Placeholder scan:** No TBDs, no "add appropriate error handling", no references to undefined symbols. `renderAccountIdentity` is defined in Task 4 Step 3 and consumed in Task 4 Steps 2 & 3. `adminGreetingEl`, `displayNameInput`, `accountEmailEl` are all pulled from the same Step 3 block.

**Type/identifier consistency:**
- Element id `adminGreeting` (HTML, Task 3) matches `getElementById('adminGreeting')` (JS, Task 4 Step 3).
- Element id `displayNameInput` (HTML, Task 4 Step 1) matches `getElementById('displayNameInput')` (JS, Task 4 Step 2 and Step 3).
- `data-section="displayname"` (HTML, Task 4 Step 1) matches `section === 'displayname'` (JS, Task 4 Step 2).
- `Auth.rawDisplayName` / `Auth.displayName` / `Auth.updateDisplayName` names are consistent across Task 1 (definition + export) and Task 4 (consumption).
- Button text "Save Display Name" is consistent with toast text "Display name saved".

**Scope:** Single plan, four commits, three files touched — appropriately scoped for one implementation cycle.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-admin-display-name.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
