# SignalRoom — Current Architecture

## Overview
SignalRoom is a Next.js 14 App Router full-stack brand crisis radar dashboard for MosaicWellness. It ingests social mentions, reviews, and complaints, applies deterministic NLP, and surfaces alerts, clusters, and playbooks.

## Stack
- **Framework**: Next.js 14 App Router (TypeScript)
- **Database**: SQLite via `@prisma/adapter-libsql` (Prisma v7, no `url` in datasource block)
- **ORM**: Prisma v7 — db client in `src/lib/db.ts`
- **Styling**: TailwindCSS v3 with dark theme (`bg-[#0a0e1a]`)
- **Charts**: Recharts v3
- **CSV parsing**: PapaParse (dynamicTyping: true — coerce URL columns with `String()`)
- **UI primitives**: Radix UI (some components)

## Data Sources (static files in /data/)
| File | Format | Records | Channel |
|------|--------|---------|---------|
| reviews_amazon.csv | CSV | 54 | amazon |
| reviews_nykaa.csv | CSV | 43 | nykaa |
| reviews_google.csv | CSV | 25 | google |
| reddit.json | JSON | 31 | reddit |
| twitter.json | JSON | 31 | twitter |
| instagram.json | JSON | 20 | instagram |
| complaints_history.csv | CSV | 60 | complaints |
| competitors.csv | CSV | varies | competitor synthetic |

## Data Model (prisma/schema.prisma)
- **Mention** — core record: sentiment, issue labels, entities, credibility, blast radius
- **Product** — catalog: name, SKU, brand, category
- **Competitor** — competitor metadata
- **CrisisAlert** — auto-generated spike/contagion alerts
- **DailyBrief** — cached executive summary (one per date)
- **NarrativeCluster** — TF-IDF story groups
- **HourlyAggregate** — time-series buckets for performance

## Ingestion Pipeline (src/lib/ingestion.ts)
1. PapaParse reads CSV/JSON from /data/
2. `processText()` runs: language → sentiment → taxonomy → entities → credibility → blastRadius
3. Upsert into Mention table + compute HourlyAggregate buckets
4. Triggered via POST /api/ingest

## NLP Modules (src/lib/)
- `sentiment.ts` — AFINN-style scoring (-1 to +1), sarcasm detection
- `taxonomy.ts` — multi-label 7-category classifier (product_quality, delivery, packaging, pricing, support, side_effects, trust_authenticity)
- `entities.ts` — extract products, order IDs, delivery partners, locations
- `credibility.ts` — 0–100 score by channel + text signals; blast radius (contained/watch/high_risk)
- `language.ts` — en/hi/hi-en detection
- `anomaly.ts` — Robust Z-score + EWMA anomaly detection
- `clustering.ts` — TF-IDF + cosine greedy clustering
- `playbooks.ts` — per-issue response templates

## API Routes (src/app/api/)
| Route | Method | Purpose |
|-------|--------|---------|
| /api/ingest | POST/GET | Run ingestion pipeline |
| /api/crisis/alerts | GET/POST | Fetch/generate crisis alerts |
| /api/feed | GET | Paginated mention stream |
| /api/narratives | GET | TF-IDF clusters |
| /api/kpis | GET | KPI health metrics |
| /api/brief/today | GET | Daily brief (cached) |
| /api/incident/[id] | GET/PATCH | Alert detail + status update |
| /api/replay | GET | Time-series for replay |
| /api/issues/heatmap | GET | Product × Issue matrix |
| /api/benchmark | GET | Competitor comparison |

## Alert Detection (src/app/api/crisis/alerts/route.ts)
Three trigger types:
1. **volume_spike** — robust Z-score + EWMA on negCount per (product, issue, channel) tuple
2. **cross_channel** — same issue across ≥2 channels in 12h window
3. **high_reach** — individual mention with blastRadius=high_risk or engagement>200

All time windows anchor to **latest DB timestamp** (data-relative) to support sample data from any date.

## Dashboard Pages (src/app/)
| Route | File | Purpose |
|-------|------|---------|
| / | page.tsx | Main mission-control dashboard |
| /incident/[id] | incident/[id]/page.tsx | Incident Room detail |
| /evaluation | evaluation/page.tsx | Data quality metrics |

## Key Conventions
- Prisma singleton in `src/lib/db.ts` using `PrismaLibSql` adapter
- All API routes are Next.js Route Handlers (app router)
- Dark theme: `bg-[#0a0e1a]`, `bg-[#0d1117]`, panels use `.panel` CSS class
- Time anchoring: always query `latestMention.timestamp` as "now"
- PII: order IDs stored in DB but redacted in UI example posts
