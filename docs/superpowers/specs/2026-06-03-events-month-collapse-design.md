# Events Page — Collapsible Months Under Past-Event Years

## Context

The Events page groups past events under year-level collapse toggles (e.g., "2026 ▸"). Inside an opened year, months currently render as static `<h4>` headings with all their event cards visible. As more events accumulate, an opened year will become a long scroll. This spec adds a second collapse layer at the month level so the past-events area stays scannable.

## Goal

Inside each opened year, present months as collapsible groups. When a year is opened, automatically expand its newest month so the user immediately sees content; older months stay collapsed until clicked.

## Scope

In scope:
- Markup change in [js/events-page.js](../../js/events-page.js) `pastGroupedHtml()` to render months as collapsible groups instead of plain headings.
- CSS additions in [css/events.css](../../css/events.css) for month-level toggle styling and animation.
- JS interaction in [js/events-page.js](../../js/events-page.js) `setup()` to (a) toggle months on click, (b) auto-open the newest month when a year is opened.

Out of scope:
- Any change to upcoming-events rendering.
- Any change to the year-level toggle behavior.
- Persisting expand/collapse state across page loads.

## Design

### Markup

Replace the current per-month fragment:

```html
<div class="events-month-group">
  <h4 class="events-month-heading">June</h4>
  <div class="events-list">…cards…</div>
</div>
```

with a button-driven group that mirrors the existing year pattern one level smaller:

```html
<div class="events-month-group">
  <button type="button" class="events-month-heading" aria-expanded="false">
    <span class="events-month-arrow"></span>June
  </button>
  <div class="events-month-content">
    <div class="events-month-content-inner">
      <div class="events-list">…cards…</div>
    </div>
  </div>
</div>
```

### CSS

Add a month-level block in [css/events.css](../../css/events.css) cloned from the existing `.events-year-*` rules, with these visual differences so hierarchy is preserved (Year loud → Month quiet → Cards):

- Smaller chevron (`.events-month-arrow`)
- Lighter font weight on the heading
- No top border between months (year groups have one)
- Tighter vertical padding
- Same `grid-template-rows: 0fr → 1fr` animation pattern used by `.events-year-content`
- `.events-month-group.open .events-month-arrow` rotates the chevron, matching the year pattern

### JS Interaction

In `setup()` after past events render:

1. **Month toggle handler** — delegated click handler on `pastList`: when a `.events-month-heading` is clicked, toggle `.open` on its parent `.events-month-group` and flip its `aria-expanded`.
2. **Auto-open newest month on year open** — extend the existing year-click handler. When a year transitions to open AND none of its descendant `.events-month-group` elements already have `.open`, add `.open` (and set `aria-expanded="true"` on the button) to the first month group inside that year. The "none already open" check prevents fighting a user who manually opened an older month, then collapsed and re-opened the parent year.

### Accessibility

Both year and month controls remain real `<button>` elements with `aria-expanded` reflecting state. Keyboard reachable, focus-visible ring inherits from existing button styles. Reduced-motion users get the same behavior as the year toggle (the existing animation is short and grid-row based; no separate handling needed beyond what's already in place).

### Edge Cases

- **Single-month years** — still collapse; the one month auto-opens on year expand, so the user sees content immediately. Behavior stays consistent.
- **Empty years** — cannot occur; month groups are only created when an event lands in them.
- **User collapses then re-opens a year** — auto-open logic only fires when no month in that year is currently open, so a user who explicitly closed every month inside a year won't have one re-open against their will when they toggle the year. (The newest will auto-open the very first time, which is the desired default.)

## Success Criteria

- Opening "2026" shows month headings stacked tightly; the newest month is already expanded with its cards visible.
- Clicking a collapsed month expands it with the same animation feel as the year toggle.
- Clicking an expanded month collapses it.
- No regression to the existing year-level toggle, upcoming events, or the overall "Show past events" toggle.
- Keyboard users can reach and operate both year and month toggles; `aria-expanded` reflects state for screen readers.
