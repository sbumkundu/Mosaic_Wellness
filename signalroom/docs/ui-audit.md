# SignalRoom UI Audit

**Date:** February 2026
**Auditor:** Claude (senior UI/UX + frontend)
**Scope:** All pages, components, design tokens, accessibility

---

## What the User Sees First (First-10-Seconds Critique)

When a CX head opens SignalRoom at `/`:
1. They see a header bar with 4 unlabelled icon-buttons
2. A horizontal KPI strip with 7 metrics — but **no clear "what's the most important thing right now"**
3. Three panels side-by-side: Live Feed, Crisis Radar, Issue Heatmap — all at equal visual weight
4. Immediately below: Daily Brief, Competitor Panel, Trust widget — more horizontal information

**Problem:** There's no hierarchy. Everything competes for attention. A user can't answer "what's happening today?" in under 10 seconds. The most actionable info (active alerts, critical incidents) is buried in the Crisis Radar panel.

---

## Top 10 Usability Issues

### U1 — No "What Should I Do First?" Signal
The dashboard presents 8 widgets at equal priority. There is no primary "action zone" — the most urgent alert gets the same visual weight as language breakdowns. A CX head should see the single most critical thing immediately.

**Impact:** High. Decision latency is increased.
**Fix type:** Quick win — add a Hero Strip above the grid.

---

### U2 — Crisis Radar links to Legacy Route
`CrisisRadar.tsx` line 176: `router.push('/incident/${alert.id}')` routes to the **legacy** `/incident/[id]` route rather than the improved `/incidents/[id]`. This is a broken navigation link.

**Impact:** Critical (broken UX).
**Fix type:** Quick win — change to `/incidents/${alert.id}`.

---

### U3 — Incidents Table Has No Search
The filter bar on `/incidents` has dropdown selects for Status, Severity, and Channel — but **no free-text search**. Finding a specific incident by title or product requires knowing the exact dropdown values.

**Impact:** High. Users must scroll through the full list.
**Fix type:** Quick win — add a search input.

---

### U4 — Empty States Say "Run Backfill" Without Explanation
Throughout the app, empty states say things like:
- "Run backfill to detect from existing data"
- "Run backfill to compute blast radius"
- "No simulation data — run backfill"

New users won't know what "backfill" means or how to run it. There's no clear CTA, no explanation of the system state.

**Impact:** High. User abandonment on first encounter.
**Fix type:** Medium — improve empty state copy and add guided CTAs.

---

### U5 — Response Generator Has No Visual Flow
The Response tab shows 3 dropdowns (Channel, Issue Type, Brand Voice) followed by a Generate button — all in one horizontal row. There is no indication this is a multi-step workflow or what each step produces. The generated response appears below with no visual separation or success feedback.

**Impact:** Medium. Users may not find or understand the feature.
**Fix type:** Medium — add step numbers, better layout, copy button.

---

### U6 — Status Update Is a Bare Select Dropdown
On the incident detail page, updating status uses a native HTML `<select>` in the header with emoji prefixes (`🔴 Active`). This is:
- Hard to target on mobile
- Not keyboard accessible with expected behavior
- Visually inconsistent with the rest of the UI

**Impact:** Medium. Every time a CX team member wants to update incident status, they fight the UI.
**Fix type:** Medium — use Radix Select.

---

### U7 — No Keyboard Navigation or Focus Management
None of the filter pills, table rows, or tab buttons have visible focus rings. Keyboard-only users (and screen reader users) cannot navigate the app. The incidents table rows are `div`-like `tr` elements with `onClick` but no `role` or keyboard support.

**Impact:** High (accessibility).
**Fix type:** Medium — add `focus-visible:ring` to all interactive elements.

---

### U8 — Loading State Is Animated Text, Not Skeletons
When loading data, pages show:
- `animate-pulse` text: "Loading incidents…"
- Or a row of blank gray boxes in KPIStrip

This causes layout shift when data arrives. Skeleton screens that match the final layout prevent this.

**Impact:** Medium. Reduces perceived performance.
**Fix type:** Quick win — add layout-matched skeleton components.

---

### U9 — "Simulate Feed" Button Uses Danger Style for Non-Dangerous Action
The "Simulate Feed" nav button uses `nav-btn-danger` (red tint) which implies a destructive action. Feed simulation is non-destructive — it just replays historical data. This misleads users.

**Impact:** Low-Medium. Creates unnecessary hesitation.
**Fix type:** Quick win — change to standard `nav-btn` or an accent variant.

---

### U10 — Incident Detail Has No "What Changed" Summary Before Tabs
The incident detail page jumps directly into a bordered summary box + tab bar. There is no hero section that answers: "This is what happened. Here's what to do." A user must read the full summary text, then pick a tab, to understand the situation.

**Impact:** High. Decision latency increases.
**Fix type:** Medium — add a structured hero section with key metrics above tabs.

---

## Top 10 Visual Issues

### V1 — Typography Scale Is Too Compressed (Density Over Clarity)
The entire app uses 10–13px for nearly everything. Labels are 10-11px uppercase. Body text is 11-12px. Metric values are the only things at 18-21px. This creates:
- Poor readability at a glance
- No clear hierarchy between labels, values, and context text
- Fatigue for sustained use

**Fix:** Use at minimum 13px body, 15px for important data, 11px only for metadata.

---

### V2 — Charts Have No Captions or "So What" Text
Every Recharts chart (Trust Trend, Timeline, Competitor Health, Simulation) displays data without explaining what it means. A user who sees the Trust Index chart at 48 doesn't know if that's good, bad, or normal.

**Fix:** Add a `<p className="chart-caption">` below each chart explaining the key insight.

---

### V3 — Emoji Icons Feel Inconsistent With Pro Dark-Mode Aesthetic
Emoji are used extensively:
- Tab icons in incident detail: `🎯 🔬 🔮 📝 🕵`
- Channel icons: `📦 💄 ⭐ 🔴 🐦 📸 📋`
- Status icons: `⚠️ 🔍 💥 🧨 🛡`

While functional, emojis render differently across OS/browser, break the visual consistency, and feel consumer-app rather than mission-control. Lucide icons are already installed.

**Fix:** Replace all emoji icons with Lucide equivalents.

---

### V4 — Color Roles Overlap (Red Means 4 Things)
Red (#ef4444 / danger) currently means:
1. Critical severity badge
2. Active status dot
3. Negative sentiment
4. Crisis/high-risk blast radius

This makes it impossible to scan the page and quickly understand what "red" means in context.

**Fix:** Add subtle background tint differences and use icon + color (never color alone) for meaning.

---

### V5 — Incident Detail Summary Box Uses Severity Color for Background
The summary box at the top of incident detail uses `${sevStyle}` (severity colors) for its border AND background:
```tsx
<div className={`rounded-xl border p-4 mb-4 ${sevStyle}`}>
```
A critical incident gets a red-bordered, dark-red-background box that makes the text inside harder to read. The severity should be communicated via a badge, not a full background tint.

**Fix:** Use neutral panel background with a left accent border and severity badge.

---

### V6 — Filter Bar on Incidents Page Is Underpowered
Three native `<select>` elements with minimal styling sit in a panel. They don't communicate which filters are active via visual states (no active pill style), and the current count shows as plain text: "42 incidents".

**Fix:** Style active filters as colored pills; show a "clear filters" affordance when active.

---

### V7 — Main Dashboard Grid Uses Hardcoded Pixel Heights
```tsx
style={{ height: "calc(100vh - 280px)", minHeight: "520px" }}
```
This fixed-height constraint causes panels to clip their content on smaller screens and creates dead space on tall screens. The grid should be content-driven with max-height overflow.

**Fix:** Use `overflow-y-auto` per panel, remove the hardcoded container height.

---

### V8 — Competitor Panel Line Chart Has 6 Lines With No Default Focus
The CompetitorPanel shows 6 brand trend lines simultaneously with no way to focus on one. The legend is 10px and overlaps when brands have similar scores. This is impossible to parse at a glance.

**Fix:** Show top 3 lines by default + "Show all" toggle. Highlight the primary brand.

---

### V9 — Header Nav Buttons Are Text-Heavy on Mobile
Four action buttons in the header (Load Data, Incidents, Data Quality, Simulate Feed) each have icon + text. At smaller viewports they overflow or wrap. There's no responsive handling.

**Fix:** Show icon-only on mobile, icon+text on desktop. Use `hidden sm:inline` pattern.

---

### V10 — No Consistent Page Transition or Visual Feedback for Navigation
Navigating between pages (Dashboard → Incidents → Detail) has no visual feedback — no loading indicator, no breadcrumb, no back button hierarchy. Users lose spatial context.

**Fix:** Add breadcrumb trail, consistent `PageHeader` component with contextual back navigation.

---

## Confusing Terminology

| Current Term | CX-Friendly Replacement | Reason |
|---|---|---|
| Blast Radius | Spread Risk | "Blast radius" is military jargon; "spread risk" is intuitive |
| Narrative Hijack | PR Escalation Risk | "Hijack" is alarming and vague; escalation risk is measurable |
| Clusters | Root Causes | "Clusters" is ML/data-science terminology |
| Attribution | Drivers | "Attribution" is marketing/legal; "drivers" is CX-native |
| Backfill | Detect Incidents | "Backfill" is engineering jargon; the action is detecting incidents |
| Blast Radius: watch | Monitoring | "Watch" is meteorological jargon |
| Trust Index Delta | Trust Change | "Delta" is mathematical jargon |
| neg_share | Negative Rate | Abbreviation with underscore is code, not UI |

---

## Quick Wins vs Medium Effort

### Quick Wins (< 2h each)
- Fix CrisisRadar routing bug (`/incident/` → `/incidents/`)
- Change "Simulate Feed" from danger to accent button style
- Add search input to incidents filter bar
- Add `focus-visible:ring` to all interactive elements in globals.css
- Replace emoji tab icons with Lucide icons in incident detail
- Add chart captions to all Recharts charts
- Fix `CRITICAL` missing from `RISK_BADGE` map (currently shows no badge style)
- Add copy button to response text area

### Medium Effort (half-day each)
- Build `<RiskBadge>`, `<Skeleton>`, `<EmptyState>`, `<SectionHeader>`, `<PageHeader>` components
- Add Hero Strip to main dashboard
- Restructure incident detail hero section (metrics grid before tabs)
- Improve empty states with guided CTAs and CX-friendly copy
- Add sorting to incidents table (Most Urgent, Newest, Fastest Growing)
- Replace hardcoded grid height with content-driven layout
- Replace terminology throughout (Blast Radius → Spread Risk, etc.)
- Improve response generator into stepper-style flow with copy button
