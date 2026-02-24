# SignalRoom UI Changelog

**Sprint:** UI/UX Overhaul v1.1
**Date:** February 2026

---

## Before / After Summary

### Bug Fixes

| # | Issue | Fix | File |
|---|-------|-----|------|
| B1 | CrisisRadar linked to legacy `/incident/[id]` route — broken navigation | Changed to `/incidents/[id]` | `CrisisRadar.tsx` |

---

### New Components (`/src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `RiskBadge.tsx` | Standardised severity pill (CRITICAL / HIGH / MED / LOW) with optional score; also exports `SeverityDot` for compact contexts |
| `Skeleton.tsx` | Layout-matched loading skeletons: `SkeletonLine`, `SkeletonCard`, `SkeletonKPIStrip`, `SkeletonTableRow`, `SkeletonBlock` |
| `EmptyState.tsx` | Guided no-data state with icon, title, description, and CTA action |
| `SectionHeader.tsx` | Consistent H2 section heading with optional subtitle and right-aligned action |
| `MetricCard.tsx` | Single KPI card with label, large value, directional delta, and footer slot |
| `PageHeader.tsx` | Sticky page header with breadcrumb trail, back button, status message, and actions slot |
| `ChartCaption.tsx` | Contextual plain-English explanation below every chart |

---

### `globals.css` Additions

| Token / Class | What It Does |
|---------------|-------------|
| `:focus-visible` global rule | Cyan `outline: 2px solid #06b6d4` on all interactive elements — fixes accessibility gap |
| `.btn-primary` | Cyan background CTA button (for Generate, primary actions) |
| `.chart-caption` | 11px gray caption below charts |
| `.triage-table` | Full table style with sticky header, hover rows, keyboard-accessible rows |
| `.filter-bar` | Sticky filter row above tables (top: 49px, z-20) |
| `.search-input` | Styled text search field with left icon slot |
| `.section-divider` | Full-width `border-t` separator |
| `.sort-btn` | Sortable column header button with active state |
| `.step-number` | Numbered stepper circle (active / done variants) |
| CSS variable `--accent`, `--border` | Centralised token for brand cyan and border gray |

---

### Dashboard (`/src/app/page.tsx`)

| Before | After |
|--------|-------|
| No "what's the most important thing right now" signal | **Hero Strip** added at top: Brand Health gauge + Active Incidents count + Highest Risk Incident |
| All 8 widgets at equal visual priority | Hero Strip creates clear primary / secondary hierarchy |
| "Simulate Feed" button used danger red style | Changed to standard `nav-btn` — not a destructive action |
| Raw SVG inline icons in nav buttons | Replaced with Lucide icons (`Download`, `AlertTriangle`, `BarChart2`, `Play`) |
| Fixed-pixel grid height (`calc(100vh - 280px)`) causing layout issues | Changed to content-driven `minHeight` / `maxHeight` per column |
| Ingest result was prefix-controlled with `✓`/`✗` characters | Hero data refetch on ingest; status message uses semantic `ok` boolean |
| No responsive icon labels | Nav button text hidden on mobile (`hidden sm:inline`), icons always visible |

---

### Incidents List (`/src/app/incidents/page.tsx`)

| Before | After |
|--------|-------|
| No free-text search | **Search input** with live client-side filtering across title, summary, product, channel |
| Three bare `<select>` dropdowns | Styled dropdowns inside a sticky `.filter-bar` component |
| No active filter indication | **"Clear" button** appears when any filter is active |
| No sort control | **Sort presets**: Most Urgent / Newest / Highest Impact / Trust Delta — plus clickable column headers with direction indicator |
| Plain `animate-pulse` text loading state | `SkeletonTableRow` × 6 matching the final table layout |
| Empty state said "Run backfill" (jargon) | `EmptyState` component with CX-friendly copy and guided CTA |
| "Run Backfill" button label | Renamed to **"Detect Incidents"** |
| Emoji channel icons in table | Kept emoji for channel glyphs (quick scan value); Lucide icons for structural elements |
| Severity uses ad-hoc inline styles | Uses `<RiskBadge>` component |
| Narrative risk badge missing CRITICAL style | `RiskBadge` handles all 4 levels consistently |
| Table has no keyboard navigation | `tabIndex=0`, `role="button"`, `onKeyDown` on every row |
| Impact shown as plain number | **Impact score** now shows number + mini progress bar |
| "Narrative Risk" column header | Renamed to **"PR Risk"** (CX-friendly) |
| "Trust Δ" column header | Kept with tooltip; `tabular-nums` for alignment |
| Using `PageHeader` inline in each page | Now uses `<PageHeader>` component with breadcrumb |

---

### Incident Detail (`/src/app/incidents/[id]/page.tsx`)

| Before | After |
|--------|-------|
| Loading state: simple grey screen | Layout-matched `SkeletonBlock` grid |
| Error state: plain text + back button | `EmptyState` component with icon and clear action |
| Summary box used severity color as full background | **Hero Decision Strip**: neutral panel with left accent border, badges, 2-line summary, quick-action buttons |
| No quick actions visible before tab click | "Mark Investigating", "Mark Resolved", "Draft Response", "View Root Causes" buttons in hero strip |
| Tabs used emoji icons (🎯 🔬 🔮 📝 🕵) | **Lucide icons**: `Target`, `Search`, `LineChart`, `MessageSquare`, `Eye` |
| Tabs had no `role="tab"` or `aria-selected` | Proper ARIA attributes for screen reader support |
| "Blast Radius" heading | Renamed to **"Spread Risk"** |
| "Narrative Risk" heading | Renamed to **"PR Escalation Risk"** |
| "Clusters" tab label | Tab renamed to **"Root Causes"** |
| "Attribution" section | Renamed to **"Drivers Breakdown"** |
| Cluster cards: plain text, no action guidance | Cards now have: Driver N label, delta-above-normal callout, "Suggested next step" box, collapsible examples via `<details>` |
| Root cause entities had no icon context | Attribution charts use `MapPin`, `Truck`, `BarChart2` icons |
| All charts: no captions or context | **`<ChartCaption>`** added below every chart with plain-English insight |
| Trust trend chart: no reference line | Added amber `ReferenceLine` at y=50 (caution threshold) when trust is below 50 |
| Spread Risk card: no visual bar | Impact score now shows a color-coded progress bar |
| PR Escalation Risk: score only | Added contextual interpretation text ("High risk — act within hours") |
| Response generator: 3 unlabelled dropdowns + button | **Stepper flow**: numbered steps 1–4 with labels (Channel → Issue Type → Brand Voice → Generate) |
| Generate button: plain `nav-btn` | Changed to `btn-primary` (cyan) for clear primary action |
| Response text: no copy button | **Copy to clipboard** button with tick confirmation state |
| Checklist items: no visual completion | Checked items get `line-through` strikethrough style |
| Red flags: "No red flags" plain text | Shown in green tinted banner with `Check` icon |
| Response tab shows blank when no response | `EmptyState` with guidance on how to generate |
| Competitor tab: plain text content | `SectionHeader` components; evidence wrapped in `<details>` collapsible |
| Empty competitor tab: emoji only | `EmptyState` with `Eye` icon and CX-friendly explanation |
| Status update: bare `<select>` in header | Added loading indicator (`RefreshCw` spinner) during update; labeled for screen readers |
| `Cell` from recharts (deprecated) | Removed — bars use uniform `fill` prop |
| Deprecated `Cell` import | Removed from import |

---

### Terminology Changes

| Before (ML-jargon) | After (CX-friendly) |
|---------------------|---------------------|
| Blast Radius | Spread Risk |
| Narrative Risk | PR Escalation Risk |
| Clusters | Root Causes |
| Attribution | Drivers |
| Backfill / Run Backfill | Detect Incidents |
| neg_share | Negative Rate |
| Trust Index Delta (Δ) | Trust Change (Δ kept as shorthand) |

---

## Accessibility Improvements

- `:focus-visible` global outline added — all interactive elements now show a cyan ring when keyboard-focused
- Table rows: `tabIndex=0`, `role="button"`, `onKeyDown` for Enter key navigation
- Incident detail tabs: `role="tab"`, `aria-selected`, `aria-label`
- Nav buttons: `aria-label` on icon-only buttons
- `<select>` elements: `aria-label` attributes added
- Breadcrumb: `<nav aria-label="Breadcrumb">` wrapper with `aria-current="page"` on current item
- Semantic HTML: `<details>`/`<summary>` for collapsible evidence sections

---

## Files Changed

```
src/
  app/
    globals.css                          — design tokens, new utility classes, focus rings
    page.tsx                             — hero strip, Lucide icons, layout fixes
    incidents/
      page.tsx                           — search, sort, triage table, EmptyState, PageHeader
      [id]/
        page.tsx                         — decision flow, CX terminology, chart captions, response UX
  components/
    CrisisRadar.tsx                      — routing bug fix (/incident → /incidents)
    ui/
      RiskBadge.tsx                      — NEW
      Skeleton.tsx                       — NEW
      EmptyState.tsx                     — NEW
      SectionHeader.tsx                  — NEW
      MetricCard.tsx                     — NEW
      PageHeader.tsx                     — NEW
      ChartCaption.tsx                   — NEW
docs/
  ui-audit.md                            — NEW (top 10 usability + visual issues)
  design-system.md                       — NEW (tokens, components, patterns)
  ui-changelog.md                        — NEW (this file)
```
