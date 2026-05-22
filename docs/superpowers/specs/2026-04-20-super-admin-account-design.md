# Super-Admin Backup Account — Design

**Date:** 2026-04-20
**Status:** Approved — ready for implementation plan

## Problem

The site currently has a single admin account managed through Supabase Auth. If that admin loses access — forgotten password, broken account, email issues — there is no second account that can keep the site running or help the primary admin recover.

The owner wants a second admin account (for themselves) that acts as a backup/recovery account. Both accounts should have **identical** permissions. There is no need for a role hierarchy or feature gating; the "super-admin" framing is purely about having a recovery account, not about elevated privileges.

## Non-Goals

- **No role-based access control.** Both accounts have equal powers. No RLS changes, no `app_metadata.role` claim, no role column, no role-gated UI.
- **No user-management UI in the app.** Creating, deleting, or changing admin emails is done in the Supabase dashboard.
- **No Supabase Edge Function.** If the regular admin loses access to their email inbox, recovery is performed in the Supabase dashboard (change email or set password directly). The app does not expose service-role operations.
- **No duplication of the existing Forgot Password flow.** The public login page already lets anyone trigger a password reset email for any address. The in-app recovery button is a signed-in convenience, not a new security primitive.

## Design

Two parts: one manual Supabase dashboard action, and one small UI addition.

### Part 1 — Create the second admin account (manual)

Performed once in the Supabase dashboard:

1. Supabase → Authentication → Users → Add user
2. Enter the owner's email and an initial password (or send a magic link)
3. Save

The new user immediately inherits the existing RLS policies, which grant full read/write access to any `authenticated` user. No code change, no migration.

### Part 2 — "Admin Password Recovery" section in the Settings tab

A new `<section class="settings-section">` is added to the Settings tab of [admin-dashboard.html](../../../admin-dashboard.html), placed directly after the existing "Account" section.

**Markup shape** (matches the existing settings section patterns):

- `<h2>` — "Admin Password Recovery"
- One labeled email input (`type="email"`, `autocomplete="off"`)
- One button (`.btn-save-section`) — "Send Reset Link"
- One `<p class="settings-hint">` — "Sends a Supabase password reset email to the address above. Use this if another admin is locked out."

**Behavior:**

- On click, calls the existing `Auth.sendPasswordReset(email)` in [js/auth.js](../../../js/auth.js). No new logic in `auth.js`.
- Uses the existing `showToast(msg, kind)` helper on success ("Reset link sent") and error (error message from Supabase).
- Disables the button while the request is in flight, matching the pattern used by every other section button in [admin-dashboard.html](../../../admin-dashboard.html).
- Trims and validates the email client-side (non-empty, has `@`). Invalid input shows an error toast; no Supabase call is made.
- On success, shows the toast `"Reset link sent"` and leaves the field value in place (in case the operation needs to be repeated). The hint text does not change.

**Wiring:**

- In the existing IIFE inside `admin-dashboard.html` (the `initDashboard()` function), add a click handler on the new button. This parallels how `account` / `verse` / `contact` / `social` / `donation` are wired through the `.btn-save-section` loop.
- The recovery section does **not** use the `data-section` / `SECTIONS` / `collectSection` mechanism because it isn't persisting anything to the `settings` table. It uses its own one-off click handler, similar to the `section === 'account'` special case already in the file.

### What stays the same

- `js/auth.js` is unchanged.
- `js/supabase-client.js` is unchanged.
- All existing RLS policies are unchanged.
- The public login-page Forgot Password flow is unchanged and remains the canonical path for a locked-out admin to recover on their own.

## Security Considerations

- **No privilege escalation risk.** Supabase password reset is already publicly available via the login page's Forgot Password flow. Exposing it inside an authenticated-only dashboard adds zero attack surface — any attacker who could use the dashboard button could already use the public form.
- **Rate limiting** is handled by Supabase Auth on the backend. The client does not need to throttle.
- **No email allowlist** in v1. Either admin can trigger a reset for any email. Since Supabase only sends the reset link to the actual owner of the email account, a malicious or mistyped address causes no real harm beyond a stray email.

## Testing

- Manual: sign in as either admin account, go to Settings tab, enter the other admin's email, click Send Reset Link, confirm email arrives and reset completes end-to-end.
- Manual: enter an invalid email (e.g., no `@`) and confirm the error toast appears with no Supabase call.
- Manual: enter a non-existent email and confirm Supabase's response is surfaced via toast without leaking information.
- Manual: confirm both admin accounts can perform all existing operations (create/edit/delete sermons, events, settings) — verifying that "equal powers" holds.

## Rollback

Rollback is a single-file revert of [admin-dashboard.html](../../../admin-dashboard.html). The second Supabase user can remain (harmless) or be deleted from the Supabase dashboard.
