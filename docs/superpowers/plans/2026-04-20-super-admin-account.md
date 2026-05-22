# Super-Admin Backup Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second admin account (as backup/recovery) and an in-app "Admin Password Recovery" form that reuses the existing Supabase password reset flow.

**Architecture:** One manual Supabase-dashboard action creates the second user; the second user inherits the existing `authenticated`-role RLS policies verbatim (no RLS changes). One new settings section is added to `admin-dashboard.html` that calls the already-exported `Auth.sendPasswordReset(email)`. No changes to `auth.js`, no new JS files, no database migration.

**Tech Stack:** Vanilla HTML/JS, Supabase Auth SDK (already loaded), existing `Auth` module in [js/auth.js](../../../js/auth.js).

**Spec:** [docs/superpowers/specs/2026-04-20-super-admin-account-design.md](../specs/2026-04-20-super-admin-account-design.md)

**Note on testing:** This repo has no JS test framework (package.json has only puppeteer for PDF generation; `npm test` errors out). The design is three dozen lines of HTML + click-handler wiring that calls a Supabase SDK method requiring a real backend. Following the spec's Testing section, verification is **manual in-browser** — this is the project's existing convention.

---

## File Structure

**Modified:**
- [admin-dashboard.html](../../../admin-dashboard.html) — adds one `<section>` in the Settings tab and one branch to the existing `.btn-save-section` click loop in the inline `initDashboard()` IIFE.

**Unchanged:**
- [js/auth.js](../../../js/auth.js) — `sendPasswordReset` already exists and is already exported; no changes.
- [js/supabase-client.js](../../../js/supabase-client.js) — no changes.
- RLS policies in [docs/supabase/events-migration.sql](../../../docs/supabase/events-migration.sql) and elsewhere — no changes.

**External (manual action in Supabase dashboard, not code):**
- A second user added via Supabase → Authentication → Users.

---

### Task 1: Add the "Admin Password Recovery" HTML section

**Files:**
- Modify: `admin-dashboard.html` (insert new section after the existing "Account" section inside `#tab-settings`)

- [ ] **Step 1: Locate the insertion point**

Open [admin-dashboard.html](../../../admin-dashboard.html) and find the "Account" section inside the Settings tab panel. It ends at the line:

```html
    <button class="btn-save-section" data-section="account">Update Password</button>
</section>
```

This is followed by a blank line, then `<!-- Contact Info -->`.

- [ ] **Step 2: Insert the Admin Password Recovery section**

Immediately after the closing `</section>` of the Account section, and before the `<!-- Contact Info -->` comment, insert:

```html

						<!-- Admin Password Recovery -->
						<section class="settings-section">
							<h2>Admin Password Recovery</h2>
							<div class="form-group">
								<label for="recoveryEmailInput">Admin email</label>
								<input type="email" id="recoveryEmailInput" autocomplete="off" placeholder="admin@example.org">
							</div>
							<p class="settings-hint">Sends a Supabase password reset email to the address above. Use this if another admin is locked out.</p>
							<button class="btn-save-section" data-section="recovery">Send Reset Link</button>
						</section>
```

Indentation: match the surrounding sections, which use **tabs** (six tabs of nesting — inside `<body>` → `.admin-dashboard` → `.dashboard-body` → `#tab-settings` → `.settings-stack`). If unsure, copy the exact leading whitespace from the adjacent "Contact Info" section.

The `.btn-save-section` class is important — the existing click handler in the inline script iterates `document.querySelectorAll('.btn-save-section')` and uses `data-section` to dispatch behavior. Using these two conventions wires the button into the existing loop automatically; Task 2 adds the dispatch branch.

- [ ] **Step 3: Load the page and confirm the section renders**

Serve the directory (e.g. `npx http-server .` or VS Code Live Server) and open `admin-dashboard.html` in a browser. Log in. Go to the Settings tab.

Expected: A new "Admin Password Recovery" section appears directly below "Account", with an email input, a hint line, and a "Send Reset Link" button. The button does nothing yet (no handler branch for `data-section="recovery"`), but it should be visually consistent with the other settings sections.

- [ ] **Step 4: Commit**

```bash
git add admin-dashboard.html
git commit -m "feat(admin): add Admin Password Recovery section UI"
```

---

### Task 2: Wire the Send Reset Link click handler

**Files:**
- Modify: `admin-dashboard.html` (inline `<script>` inside the `initDashboard()` IIFE — the `.btn-save-section` click handler loop)

- [ ] **Step 1: Locate the click handler**

In [admin-dashboard.html](../../../admin-dashboard.html), find the block that begins:

```js
document.querySelectorAll('.btn-save-section').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var section = btn.getAttribute('data-section');
        btn.disabled = true;
        var originalText = btn.textContent;
        btn.textContent = 'Saving…';

        var done = function () {
            btn.disabled = false;
            btn.textContent = originalText;
        };

        if (section === 'account') {
```

- [ ] **Step 2: Add the `recovery` dispatch branch**

After the existing `if (section === 'account') { ... return; }` block closes, and *before* the final generic `Settings.update(collectSection(section))...` call, insert a new branch:

```js
						if (section === 'recovery') {
							var recoveryInput = document.getElementById('recoveryEmailInput');
							var email = recoveryInput.value.trim();
							if (!email || email.indexOf('@') === -1) {
								showToast('Please enter a valid email address', 'error');
								done();
								return;
							}
							Auth.sendPasswordReset(email).then(function (res) {
								if (res.ok) {
									showToast('Reset link sent');
								} else {
									showToast(res.error || 'Could not send reset email', 'error');
								}
								done();
							});
							return;
						}
```

Match the existing tab indentation (7 tabs at this depth). The `return` at the end of the branch prevents the generic `Settings.update(...)` code from firing for the `recovery` section.

`Auth.sendPasswordReset` is already defined and exported from [js/auth.js:63-69](../../../js/auth.js#L63-L69) — no changes to that file are needed.

Per the spec, the input is **not** cleared on success — the value is left in place so the user can re-trigger if the email doesn't arrive.

- [ ] **Step 3: Reload the page and test the invalid-email path**

Reload `admin-dashboard.html`, go to Settings. Leave the Admin email field blank and click "Send Reset Link".

Expected:
- Red error toast appears with "Please enter a valid email address".
- No network request is made to Supabase (check the browser DevTools Network tab — filter on `recover`).
- Button re-enables, text returns to "Send Reset Link".

Repeat with input `"not-an-email"` (no `@`). Same expectation.

- [ ] **Step 4: Test the success path**

Enter your own email address (an email you have inbox access to) and click Send Reset Link.

Expected:
- A network request is sent to Supabase Auth (visible in DevTools Network tab — endpoint includes `/auth/v1/recover`).
- Green toast "Reset link sent" appears.
- Button re-enables, input value remains populated.
- Within ~1 minute, a Supabase password-reset email arrives in your inbox.
- Clicking the link in the email takes you to `admin-login.html` where you can set a new password.

If the email does not arrive, check: Supabase project's Auth → Email templates are enabled; the email isn't in spam; the `redirectTo` URL (set inside `Auth.sendPasswordReset`) is whitelisted in Supabase → Auth → URL Configuration → Redirect URLs.

- [ ] **Step 5: Test the error path**

Temporarily break the network (e.g., DevTools Network tab → set throttling to "Offline") and click Send Reset Link with a valid email.

Expected: Red error toast with a message from Supabase (likely a fetch/network error). Button re-enables.

Restore network before continuing.

- [ ] **Step 6: Commit**

```bash
git add admin-dashboard.html
git commit -m "feat(admin): wire Send Reset Link handler to Auth.sendPasswordReset"
```

---

### Task 3: Create the second admin account in Supabase (manual, one-time)

**Files:** None. This is a Supabase dashboard action, documented here so it is not forgotten.

- [ ] **Step 1: Open the Supabase dashboard**

Go to https://supabase.com/dashboard → select the project with URL `yfdfmqnhawgrxajtioxl` (the project referenced in [js/supabase-client.js:10](../../../js/supabase-client.js#L10)).

- [ ] **Step 2: Create the new user**

Navigate to **Authentication → Users → Add user → Create new user**.

- Email: your personal email (the one you want as the backup/recovery admin)
- Password: a strong password of your choosing, **or** check "Auto Confirm User" and send a magic link instead
- Click **Create user**

- [ ] **Step 3: Verify the user appears**

Confirm the new user shows up in the Users list, with a green "Confirmed" status. If it shows "Waiting for verification", click the user row and then **Confirm email** (or confirm via the link in your inbox).

- [ ] **Step 4: End-to-end login test from the new account**

In a private/incognito browser window, go to `admin-login.html`. Sign in with the new email + password.

Expected:
- You are redirected to `admin-dashboard.html`.
- The "Signed in as" field in the Settings tab shows the new email.
- You can create/edit/delete a test sermon and a test event — confirming the new account has the same permissions as the original admin (delete the test data afterward).

- [ ] **Step 5: Cross-account reset test**

Still signed in as the new admin, in the Settings tab, enter the **original** admin's email into the Admin Password Recovery section and click Send Reset Link.

Expected: "Reset link sent" toast; the original admin's inbox receives a reset email within ~1 minute; clicking that link lets the original admin set a new password without touching the Supabase dashboard.

---

## Self-Review

**Spec coverage:**
- Part 1 (create second admin account) → Task 3 ✓
- Part 2 markup (section, email input, hint, button) → Task 1 ✓
- Part 2 behavior (calls `Auth.sendPasswordReset`, uses `showToast`, disables button during request, validates `@`, leaves field populated on success) → Task 2 ✓
- Testing section (valid reset, invalid email, non-existent email, both accounts equal powers) → Task 2 Steps 3–5 and Task 3 Steps 4–5 ✓
- Non-goals (no RLS changes, no role flag, no Edge Function, no `auth.js` change) → plan touches only `admin-dashboard.html` ✓

**Placeholder scan:** No TBDs, no "add appropriate error handling", no "similar to Task N", no references to undefined functions. `Auth.sendPasswordReset` is pinpointed to [js/auth.js:63-69](../../../js/auth.js#L63-L69). `showToast` is defined locally inside the same IIFE the handler lives in, already in scope.

**Type/identifier consistency:** `recoveryEmailInput` is the id used in both Task 1 (HTML) and Task 2 (JS `getElementById`). `data-section="recovery"` matches the `section === 'recovery'` dispatch string. Button text "Send Reset Link" is consistent across HTML and the test-step expectations.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-super-admin-account.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
