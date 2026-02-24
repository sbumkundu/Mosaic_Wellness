# SignalRoom — Real-time Brand Crisis Radar + CX Daily Brief

A mission-control dashboard for real-time brand reputation monitoring, crisis prediction, and competitive benchmarking. Built for MosaicWellness.

---

## How to Run Locally

### 1. Install dependencies

```bash
cd signalroom
npm install
```

### 2. Initialize the database

```bash
npx prisma db push
```

### 3. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000

### 4. Load sample data

Click **"⇣ Ingest Data"** in the top-right of the dashboard, or:

```bash
curl -X POST http://localhost:3000/api/ingest
```

Loads all 7 data files from `/data/` (~314 mentions, ~1-2 seconds).

### 5. Generate crisis alerts

Click **"↻ Detect"** in the Crisis Radar panel, or:

```bash
curl "http://localhost:3000/api/crisis/alerts?refresh=true"
```

---

## How to Demo in 60 Seconds

1. Open `http://localhost:3000`
2. Click **"⇣ Ingest Data"** → status bar confirms 314 mentions ingested
3. **KPI Strip**: Health score 35/100, 89% neg volume, delivery as top issue (53%)
4. **Crisis Radar** auto-detects: high-risk delivery spike + cross-channel contagion
5. Click a **Crisis Card** → Incident Room: timeline chart, narrative clusters, location breakdown, auto-triage playbook with editable checklist
6. **Daily Brief panel**: expand to see 5 exec sentences + recommended actions → "↓ Download"
7. Click **"▶ Replay Mode"** → press Start Replay → watch 48h crisis unfold at 5× speed, high-risk posts pulse red
8. Visit `/evaluation` for coverage metrics and early-warning case studies

---

## Architecture

```
signalroom/
├── data/                     Sample CSV/JSON (7 channels, 314+ records)
├── prisma/schema.prisma      SQLite schema (7 models)
└── src/
    ├── lib/
    │   ├── sentiment.ts      AFINN-style deterministic sentiment + sarcasm
    │   ├── taxonomy.ts       Multi-label issue classifier (7 categories)
    │   ├── entities.ts       Regex + dictionary NER (products, orders, partners, locations)
    │   ├── credibility.ts    Credibility scoring (0-100) + blast radius estimator
    │   ├── language.ts       Language detector (en/hi/hi-en)
    │   ├── anomaly.ts        Robust Z-score + EWMA anomaly detection ensemble
    │   ├── clustering.ts     TF-IDF + cosine similarity narrative clustering
    │   ├── playbooks.ts      Auto-triage playbooks per issue type
    │   └── ingestion.ts      Full ingestion + normalization pipeline
    ├── app/
    │   ├── page.tsx           Mission-control dashboard
    │   ├── incident/[id]/     Incident Room (timeline, clusters, playbook)
    │   ├── evaluation/        Evaluation + metrics page
    │   └── api/               10 API routes (feed, kpis, heatmap, crisis, benchmark, brief, incident, replay...)
    └── components/            KPIStrip, LiveFeed, CrisisRadar, IssueHeatmap,
                               CompetitorPanel, DailyBrief, ReplayMode
```

---

## Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Framework   | Next.js 14 (App Router) + TypeScript              |
| Styling     | TailwindCSS (dark mission-control theme)          |
| Database    | SQLite via Prisma v7 + libsql adapter             |
| Charts      | Recharts                                          |
| Data parsing| PapaParse (CSV), native JSON                      |
| ML/NLP      | Deterministic baseline — no LLM required          |

---

## Env Vars

| Variable       | Required | Default              | Description                          |
|----------------|----------|----------------------|--------------------------------------|
| `DATABASE_URL` | Yes      | `file:./prisma/dev.db` | SQLite path                        |
| `LLM_API_KEY`  | No       | —                    | Optional: enhanced LLM classification |

---

## What's Simulated vs Real

| Data Source          | Status                                              |
|----------------------|-----------------------------------------------------|
| Amazon reviews       | Real sample (54 records)                            |
| Nykaa reviews        | Real sample (43 records)                            |
| Google reviews       | Real sample (25 records)                            |
| Reddit posts         | Real sample (31 records)                            |
| Twitter mentions     | Real sample (31 records)                            |
| Instagram posts      | Real sample (20 records)                            |
| Complaint history    | Real sample (60 records)                            |
| Competitor mentions  | **Simulated** (10 synthetic per brand, labeled SIM) |
| Sentiment analysis   | Deterministic AFINN baseline (no API key needed)    |
| Real-time updates    | 10-second polling                                   |

---

## Crisis Signals in Sample Data

1. **Delivery Crisis (Jan 28-30)**: Delhivery SLA breach → 15+ negative reviews across Amazon, Reddit, Twitter → cross-channel contagion → high-risk alert
2. **Counterfeit Alert**: Reddit thread (892 upvotes) + lab test confirmation (1,876 upvotes) → trust_authenticity spike
3. **Biotin Side Effects**: Reddit post (687 upvotes) + Twitter amplification (1,234 likes) → side_effects cross-channel signal

---

## Replay Mode

Loads last 48h of events from the database and replays them chronologically at **5× speed** using staggered `setTimeout` offsets. High-risk events pulse red. Shows the delivery crisis unfolding event-by-event. Toggle: **▶ Replay Mode** in the dashboard header.

---

## Key Differentiators

- **Credibility Score (0-100)**: Weighted by channel trust, text length, order ID presence, engagement, sarcasm, spam patterns
- **Blast Radius Estimator**: `contained | watch | high_risk` from sentiment × engagement × credibility × cross-channel count
- **Narrative Clustering**: TF-IDF + cosine similarity groups mentions into named Stories with growth rate
- **Auto Triage Playbooks**: Per-issue playbooks with response templates, internal checklists, SLA, and owner
- **Language/Tone Guard**: Sarcasm detection + confidence meter + Hinglish detection
- **Data-relative timestamps**: All time windows anchor to the latest data timestamp — sample data from any date works correctly
