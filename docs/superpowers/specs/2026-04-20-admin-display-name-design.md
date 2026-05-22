# Admin Display Name + View-Site New Tab — Design

**Date:** 2026-04-20
**Status:** Approved — ready for implementation plan

## Problem

When an admin signs into the dashboard there is no visible confirmation of *whose* account they are using — only the email appears, and only if they scroll to the Settings tab. With two admin accounts now in play (primary admin + owner's backup account), the owner wants an at-a-glance indicator that they are signed into the right account. Admins also want to set a friendly display name for themselves rather than showing their raw email address.

Additionally, the top-bar "View Site" link currently navigates away from the dashboard in the same tab, which loses the admin's context (form state, scroll position, in-progress work). It should open the public site in a new tab instead.

## Non-Goals

- **No public-site usage of the display name.** The name is admin-UI only.
- **No per-role styling.** Both admin accounts are equal; the greeting looks the same regardless of which account is signed in.
- **No new database table.** The name is stored on the Supabase auth user itself via `user_metadata.display_name`.
- **No name sync with external systems** (Notion, email signatures, etc.).
- **No validation beyond "trim and persist."** Any non-empty string is a legal display name. Empty string clears the name.

## Design

Three coordinated changes — two for the display name feature, one for the View Site link.

### 1. Storage: `user_metadata.display_name`

The display name is stored on the signed-in Supabase user via the existing `supabase.auth.updateUser({ data: { display_name } })` API, which writes to the user's `raw_user_meta_data` column. `user_metadata` is:
- Writable by the user themselves (by design — this is what it's for).
- Immediately available on the next session fetch (`session.user.user_metadata.display_name`).
- Null / absent until the user sets it the first time.

No RLS changes, no new table, no migration.

### 2. `js/auth.js` additions

Three new functions exported from the existing `Auth` module:

- `rawDisplayName()` — returns the raw stored value: `_session.user.user_metadata.display_name` if the session exists and the field is a non-empty string, otherwise `null`. Used by UI code that needs to know whether a name is *actually set* (e.g., the settings input, the "Signed in as" renderer).

- `displayName()` — returns a best-effort display string for the current session, used by UI that wants *something* to show, in priority order:
  1. `rawDisplayName()` if non-null
  2. The local-part of the email (the portion before `@`) with first letter uppercased
  3. The full email string
  4. `null` if no session exists

- `updateDisplayName(name)` — trims `name`; if empty, persists `null` (which clears the field); calls `sb.auth.updateUser({ data: { display_name: <trimmed-or-null> } })`; re-hydrates the cached `_session` from the response so `rawDisplayName()` / `displayName()` return the new value immediately. Returns `{ ok: true }` or `{ ok: false, error }`, matching the shape of existing `Auth` methods.

No other `auth.js` changes. The existing `getSession`, `login`, `logout`, `requireAuth`, `changePassword`, and `sendPasswordReset` are untouched.

### 3. Top-bar greeting in `admin-dashboard.html`

Inside the existing `.admin-topbar-right` container, **before** the "View Site" link, add:

```html
<span class="admin-greeting" id="adminGreeting" aria-live="polite"></span>
```

- On page load, after `Auth.requireAuth()` succeeds, `initDashboard()` reads `Auth.displayName()`. If it returns a non-null string, the element's `textContent` is set to `"Hi, " + <name>`. If it returns null, the element is left empty (reachable only if the auth guard fails, so in practice it's always populated).
- On successful display-name save (§4), it re-renders using the same logic.

**CSS:** a new `.admin-greeting` rule in `css/admin.css` — small, matches the existing "view site / logout" button styling weight (muted color, slightly smaller than button text, no background). Exact values taken from the existing `.btn-logout` typography for visual consistency.

### 4. "Display Name" settings section

A new `<section class="settings-section">` in the Settings tab, placed **immediately after** the existing "Account" section and **before** the "Admin Password Recovery" section (so the Account-related controls cluster together at the top of Settings):

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

**Behavior:**
- On dashboard init, the input is pre-filled with `Auth.rawDisplayName()` (or empty string if null) — the input shows the actual stored value, never the email-local-part fallback.
- Clicking the button calls a new branch in the existing `.btn-save-section` click loop (mirrors the `account` and `recovery` branches): `Auth.updateDisplayName(input.value).then(...)`.
- On success: shows toast `"Display name saved"`, refreshes the top-bar greeting, and updates the "Signed in as" render in the Account section (§5).
- On error: shows an error toast with the error message.

### 5. "Signed in as" render update

The existing `accountEmail` element in the Account section currently shows just the email. It is updated to show:

- `"<rawDisplayName> (<email>)"` if a display name is actually set
- `"<email>"` if no display name is set

This decision uses `Auth.rawDisplayName()` (not `displayName()`), so the email-local-part fallback does NOT appear here — we don't want to show "John (john@...)" to a user who never set a name. Re-renders on successful display-name save.

### 6. View Site link → new tab

Current markup (in the top bar):
```html
<a href="index.html" class="btn-logout">View Site</a>
```

Updated to:
```html
<a href="index.html" class="btn-logout" target="_blank" rel="noopener noreferrer">View Site</a>
```

- `target="_blank"` opens in a new tab.
- `rel="noopener noreferrer"` prevents the new tab from accessing the dashboard's `window.opener` (security hardening — standard practice for any `target="_blank"` link).

No JS changes for this piece; HTML-only.

## Security Considerations

- **`user_metadata` is user-writable by design.** Supabase exposes it precisely so users can edit their own profile. An authenticated admin can change their own display name and nothing else — they cannot edit anyone else's metadata, and they cannot escalate into anything privileged (there is no role claim in use).
- **No XSS risk from display name** as long as it is rendered via `textContent` / template data binding (never `innerHTML`). The plan specifies `textContent` everywhere the name is displayed. No user-supplied HTML is ever executed.
- **`rel="noopener noreferrer"`** on the View Site link mitigates tabnabbing risk (low in practice because both tabs are same-origin, but following best practice costs nothing).

## Testing

Manual, browser-based (matches project convention — no JS test framework present):

- **Fresh account, never set a name:** top bar shows `"Hi, <email-local-part-capitalized>"`. Settings input is empty. "Signed in as" shows the email only.
- **Set a name:** enter "Pastor Hugh" in Settings → Save → toast confirms, top bar updates to `"Hi, Pastor Hugh"`, "Signed in as" becomes `"Pastor Hugh (pastor@…)"`. Reload the page — the name persists.
- **Clear the name:** empty the input → Save → top bar reverts to `"Hi, <email-local-part>"`, "Signed in as" reverts to email only.
- **Whitespace-only input** → saved as cleared (same as empty).
- **View Site link:** click it; the public site opens in a new tab, the dashboard tab remains on the Settings view.
- **Cross-account isolation:** sign in as admin A, set name "A"; sign out; sign in as admin B; confirm B does NOT see A's name (each user's metadata is their own).

## Rollback

- HTML + click-handler changes: revert the single admin-dashboard.html commit.
- `js/auth.js` additions: revert the `auth.js` commit.
- Supabase user-metadata values (any `display_name` already set): harmless — left in place, or cleared manually in the Supabase dashboard per user.
