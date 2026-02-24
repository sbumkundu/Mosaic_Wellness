# SignalRoom Design System

**Version:** 1.1
**Stack:** Tailwind CSS + Radix UI + Lucide React + custom CSS tokens
**Theme:** Dark mission-control (single theme, no light mode)

---

## Design Principles

1. **Clarity over density** — space is not wasted space; it is breathing room that enables faster scanning
2. **Color communicates risk** — every color has a single semantic meaning; never use red for two things
3. **Every number needs context** — a metric without a baseline, delta, or label is noise
4. **Actionable always** — every panel ends with "what to do next"
5. **Consistent rhythm** — 4px base grid; spacing is always a multiple of 4

---

## Color Tokens

### Background Layers (depth system)
```
bg-[#0a0e1a]   — page background (deepest)
bg-[#0d1117]   — sticky header
bg-[#111827]   — panel / card surface  (= .panel)
bg-[#1a2333]   — elevated panel / hover state
bg-[#1f2937]   — input / inner card background
bg-[#374151]   — dividers, button hover
```

### Brand Accent
```
#06b6d4  (cyan-500)   — primary accent: links, active states, focus rings, chart line 1
#0e7490  (cyan-700)   — accent dim: hover, pressed
#22d3ee  (cyan-400)   — accent bright: active tabs, highlights
```

### Semantic Risk Colors
Use ONLY these for risk severity — never repurpose for other meanings.

| Severity | Text | Background | Border | Use |
|----------|------|-----------|--------|-----|
| CRITICAL | `text-red-400` | `bg-red-900/20` | `border-red-700/60` | Critical incidents, P0 alerts |
| HIGH | `text-orange-400` | `bg-orange-900/20` | `border-orange-700/60` | High severity, urgent action |
| MEDIUM | `text-yellow-400` | `bg-yellow-900/20` | `border-yellow-700/40` | Medium severity, watch |
| LOW | `text-green-400` | `bg-green-900/20` | `border-green-800/30` | Low risk, healthy state |

### Semantic Signal Colors
Separate from severity — used for data signals only.

```
Positive signal:  text-green-400  bg-green-900/15  — sentiment up, trust up
Negative signal:  text-red-400    bg-red-900/15    — sentiment down, negative mentions
Neutral signal:   text-gray-400   bg-gray-800/40   — flat, unchanged
Warning signal:   text-amber-400  bg-amber-900/15  — trending bad, caution
```

### Channel Colors (immutable brand colors)
```
amazon:     #f59e0b  (amber)
nykaa:      #ec4899  (pink)
google:     #3b82f6  (blue)
reddit:     #f97316  (orange)
twitter/X:  #06b6d4  (cyan)
instagram:  #a855f7  (purple)
complaints: #ef4444  (red)
```

---

## Typography Scale

All sizes are relative to a 14px default body size. The app uses Inter font.

| Role | Size | Weight | Color | Class Pattern |
|------|------|--------|-------|---------------|
| Page title | 18px | 700 | `#f9fafb` | `text-lg font-bold text-white` |
| Section heading | 15px | 600 | `#e5e7eb` | `text-[15px] font-semibold text-gray-200` |
| Panel title | 13px | 600 | `#e5e7eb` | `.panel-title` (13px, 600) |
| Body / table row | 13px | 400 | `#d1d5db` | `text-[13px] text-gray-300` |
| Secondary body | 12px | 400 | `#9ca3af` | `text-xs text-gray-400` |
| Label / metadata | 11px | 500 | `#6b7280` | `text-[11px] text-gray-500` |
| Micro / timestamp | 10px | 400 | `#6b7280` | `text-[10px] text-gray-500` |
| Metric value (large) | 28px | 700 | contextual | `text-3xl font-bold` |
| Metric value (medium) | 20px | 700 | contextual | `text-xl font-bold` |
| Metric label | 11px | 500 | `#9ca3af` | `.metric-label` |

**Rule:** Never go below 10px. Never use font-weight 400 for labels (use 500 minimum).

---

## Spacing Rhythm

Base unit: 4px. All spacing values are multiples of 4.

```
gap-1   = 4px    — between icon and text in a button
gap-2   = 8px    — between related elements
gap-3   = 12px   — between form fields / items in a group
gap-4   = 16px   — between sections within a panel
gap-6   = 24px   — between panels / cards
gap-8   = 32px   — between page sections
p-3     = 12px   — compact panel padding
p-4     = 16px   — standard panel padding
p-5     = 20px   — spacious panel padding
p-6     = 24px   — page-level padding
```

---

## Layout Grid

```
Max width:        1600px (incidents, detail) / 1800px (dashboard)
Page padding:     px-4 to px-6 on main content
Panel gap:        gap-4 (16px)
Grid columns:     12-col grid for dashboard; flexible for detail

Standard breakpoints:
  sm: 640px
  md: 768px
  lg: 1024px
  xl: 1280px
```

---

## Component Specifications

### `<PageHeader>`
Sticky top navigation bar with breadcrumb + actions.

```
Height:           48px (py-3)
Background:       #0d1117 + border-b border-gray-800
Breadcrumb:       icon → parent page → current page
Action area:      right-aligned, gap-2
Font:             13px, font-semibold for current page
z-index:          z-30
```

### `<RiskBadge severity>`
Severity pill badge.

```
Variants:         critical | high | medium | low | pr-escalation (HIGH) | spread (HIGH)
Padding:          px-2 py-0.5
Border radius:    rounded-full
Font:             10px, font-semibold, uppercase
Always shows:     text label + optional numeric score
```

### `<MetricCard>`
Single KPI display with label, value, delta, and optional trend.

```
Padding:          p-4
Structure:        metric-label → large value → delta/context
Value sizes:      text-2xl or text-3xl
Delta:            11px, color-coded (green up, red down)
Loading:          skeleton matches card dimensions
```

### `<SectionHeader>`
Heading above a content group within a page.

```
Structure:        H2 title + optional subtitle + optional right-aligned action
Font:             15px, 600 weight
Margin bottom:    mb-3 or mb-4
Separator:        optional border-b
```

### `<EmptyState>`
No-data guidance panel.

```
Icon:             Lucide icon (not emoji) in a rounded bg-gray-800 circle
Title:            13px, font-medium
Description:      12px, text-gray-400, explains what to do next
CTA:              nav-btn with specific action (not just "try again")
Min height:       h-40
Center aligned
```

### `<Skeleton>`
Layout-matched loading placeholder.

```
Animation:        animate-pulse
Background:       bg-gray-800/60
Variants:         SkeletonLine (h-4 w-full), SkeletonCard (full card), SkeletonTableRow
Border radius:    rounded (default) or rounded-full for circular
```

### `<FilterBar>`
Horizontal filter row above a table.

```
Layout:           flex flex-wrap gap-2
Background:       panel (same as table)
Padding:          px-4 py-3
Contains:         search input + select dropdowns + sort preset + count badge
Active state:     colored border + tinted background on active filters
Clear button:     appears when any filter is active
Sticky:           optional, with sticky top-[49px] z-20
```

### `<ChartCaption>`
Contextual explanation below a chart.

```
Text:             11px, text-gray-400, italic or regular
Icon:             optional Lucide Info icon
Max width:        matches chart width
Margin top:       mt-2
```

---

## Icon System (Lucide React)

Replace all emoji icons with these Lucide equivalents:

| Semantic Use | Lucide Icon | Import |
|---|---|---|
| Incident / Alert | `AlertTriangle` | `lucide-react` |
| Critical / Emergency | `Zap` | |
| Channel (generic) | `Radio` | |
| Amazon | `Package` | |
| Product | `Package` | |
| Delivery | `Truck` | |
| Dashboard / Home | `LayoutDashboard` | |
| Incidents list | `AlertCircle` | |
| Root Cause | `Search` | |
| Simulator | `LineChart` | |
| Response | `MessageSquare` | |
| Competitor Watch | `Eye` | |
| Trust / Shield | `Shield` | |
| Narrative / PR risk | `TrendingUp` | |
| Spread Risk | `Share2` | |
| Timeline | `Clock` | |
| Channel breakdown | `BarChart2` | |
| Location | `MapPin` | |
| Delivery partner | `Truck` | |
| Back navigation | `ArrowLeft` | |
| External link | `ExternalLink` | |
| Dismiss / Close | `X` | |
| Refresh | `RefreshCw` | |
| Copy | `Copy` | |
| Check / Done | `Check` | |
| Warning | `AlertTriangle` | |
| Info / Tooltip | `Info` | |
| Rating / Star | `Star` | |
| Reddit | `MessageCircle` | |
| Twitter / X | `Twitter` (or custom) | |
| Generate | `Wand2` | |
| Download | `Download` | |

---

## States

### Loading
- Always use `<Skeleton>` that matches final layout dimensions
- Never use plain `animate-pulse` text
- Skeleton reveals within 200ms; no flash of unstyled content

### Empty
- Always use `<EmptyState>` component
- Provide context: why is it empty? what should the user do?
- Include a primary CTA that takes the user to the right action
- Never just show "No data"

### Error
- Inline errors: red-tinted banner with error message + retry button
- Toast notifications: slide in from bottom-right, auto-dismiss after 5s
- Full-page errors: centered `<EmptyState>` variant with error icon

### Success
- Inline feedback: green-tinted banner matching error style
- For actions: brief toast notification, auto-dismiss after 3s

---

## Table Patterns

```
Header:           sticky (sticky top-[97px]), bg-[#111827], border-b
Row height:       py-3 (12px top/bottom padding)
Row hover:        bg-gray-800/30
Row active:       bg-gray-800/50
Primary column:   font-medium text-gray-200 (13px)
Secondary columns: text-xs text-gray-400
Zebra striping:   optional (not currently used — keep consistent hover)
Truncation:       max-w + truncate + title attr for overflow text
Keyboard:         tabIndex=0 + onKeyDown for row click
```

---

## Chart Patterns

```
Background:       transparent (inherits panel bg)
Grid:             CartesianGrid stroke="#1f2937"
Axis labels:      fontSize: 9, fill: "#6b7280"
Tooltip:          bg: "#1f2937", border: "#374151", borderRadius: 8, fontSize: 12
Legend:           fontSize: 10, wrapperStyle padding: 4
Colors (ordered): cyan #06b6d4, red #ef4444, amber #f59e0b, green #10b981, purple #8b5cf6, gray #6b7280
Max lines:        3 visible by default; "show more" toggle for additional
Annotation:       use ReferenceLine for anomaly callouts
Caption:          always add below chart explaining key insight
```

---

## Accessibility Checklist

- [ ] All interactive elements have `focus-visible:ring-2 focus-visible:ring-cyan-500`
- [ ] Color is never the only differentiator — always paired with icon or text
- [ ] Table rows are navigable with keyboard (`tabIndex=0`, `role="button"` or use `<a>`)
- [ ] Dialogs/modals trap focus (use Radix Dialog)
- [ ] All inputs have associated `<label>` elements
- [ ] Contrast ratio ≥ 4.5:1 for body text (verified: white on #111827 = 13.6:1 ✓)
- [ ] Tooltips are accessible via keyboard (`title` attr + Radix Tooltip for complex ones)
- [ ] `aria-label` on all icon-only buttons
- [ ] `aria-live` region for toast notifications

---

## Reusable CSS Classes (globals.css)

### Existing (keep)
```css
.panel           — card container
.panel-header    — card header with border-bottom
.panel-title     — 13px semibold heading
.panel-subtitle  — 11px gray subheading
.metric-label    — 11px uppercase label above metrics
.nav-btn         — header action button
.nav-btn-danger  — destructive action variant
.filter-pill     — pill button for filter toggles
.tab-active      — active tab underline state
.tab-inactive    — inactive tab hover state
.badge-*         — status badge variants
.channel-*       — channel-specific text colors
```

### New (add)
```css
.chart-caption      — 11px italic gray, below charts
.hero-metric        — large KPI value in hero strip (text-2xl font-bold)
.section-divider    — full-width border-b border-gray-800 my-4
.action-primary     — primary CTA button (cyan bg, dark text)
.status-dot         — small status indicator circle
.focus-ring         — consistent focus ring (cyan-500, ring-2, ring-offset-0)
```
