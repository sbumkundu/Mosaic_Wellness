# SignalRoom — Data Dictionary

## Mention (core table)
| Column | Type | Values / Range | Notes |
|--------|------|----------------|-------|
| id | UUID | — | Primary key |
| source | String | "MosaicWellness" or competitor name | Brand filter |
| channel | String | amazon, nykaa, google, reddit, twitter, instagram, complaints | Platform |
| authorHandle | String? | username | May be null |
| timestamp | DateTime | data-relative (Jan 2024 sample) | Use latest as "now" |
| language | String | en, hi, hi-en | Language detection |
| text | String | full post/review | Core signal |
| product | String? | product name extracted | MosaicWellness catalog |
| sku | String? | product SKU | |
| orderId | String? | OD_*, ORD_*, AWB_*, MWOR_* | Redact in UI |
| deliveryPartner | String? | Delhivery, BlueDart, Dunzo, etc. | |
| location | String? | city or state | Indian cities/states |
| rating | Float? | 1.0–5.0 | Review star rating |
| engagement | Int | 0–N | Likes+retweets+upvotes+helpful votes |
| url | String? | post URL | Always coerce to String() |
| sentimentScore | Float | -1.0 to +1.0 | AFINN-style |
| sentimentLabel | String | neg / neutral / pos | neg ≤-0.15, pos ≥0.15 |
| issueLabels | JSON String | [{issue, confidence}] | Multi-label sorted by confidence |
| topIssue | String? | delivery, packaging, product_quality, pricing, support, side_effects, trust_authenticity | Primary issue |
| credibilityScore | Int | 0–100 | Channel base + text signals |
| entities | JSON String | {products, orderIds, deliveryPartners, locations} | Extracted entities |
| isSimulated | Boolean | true for synthetic competitor data | |
| blastRadius | String | contained / watch / high_risk | Per-mention risk |
| hasSarcasm | Boolean | true if sarcasm detected | |
| narrativeId | String? | FK to NarrativeCluster | |
| createdAt | DateTime | ingestion time | |

### New engagement columns (added in Step 1)
| Column | Type | Notes |
|--------|------|-------|
| likes | Int? | Platform likes count |
| comments | Int? | Comment count |
| shares | Int? | Shares/retweets |
| views | Int? | View count |
| authorFollowerCount | Int? | Author reach proxy |
| authorKarma | Int? | Reddit karma or equivalent |

### New trust-signal columns (added in Step 1)
| Column | Type | Notes |
|--------|------|-------|
| refundMention | Boolean | Refund/chargeback language |
| fakeClaim | Boolean | Fake review accusation |
| churnIntent | Boolean | "never ordering again" signals |
| supportFailure | Boolean | "no response", "ignored" signals |
| fraudClaim | Boolean | Fraud/scam allegations |

---

## CrisisAlert
| Column | Type | Values | Notes |
|--------|------|--------|-------|
| id | UUID | — | Primary key |
| type | String | volume_spike, cross_channel, high_reach | Alert trigger type |
| product | String? | product name | |
| channel | String? | platform | |
| issue | String? | issue taxonomy | |
| magnitude | Float | 1.5–3x+ | Spike ratio or channel count |
| confidence | Float | 0–1 | Detection confidence |
| blastRadius | String | watch, high_risk | Alert risk level |
| since | DateTime | alert start | |
| representativeMentionIds | JSON String | [uuid, ...] | Top 5 mention IDs |
| status | String | active, resolved, dismissed | |
| summary | String? | human-readable | |
| playbook | JSON String? | playbook template | |

---

## Incident (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| brandId | String | Brand identifier |
| productId | String? | Product identifier |
| title | String | Auto-generated title |
| status | String | active / investigating / resolved / dismissed |
| severity | String | low / medium / high / critical |
| createdAt | DateTime | |
| windowStart | DateTime | Incident detection window start |
| windowEnd | DateTime | Incident detection window end |
| baselineStart | DateTime | Baseline period start |
| baselineEnd | DateTime | Baseline period end |
| primaryChannel | String? | Dominant channel |
| summary | String? | Auto-generated summary |

---

## IncidentCluster (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| incidentId | String | FK → Incident |
| clusterKey | String | Unique key for cluster |
| size | Int | Mention count in cluster |
| summary | String | Cluster summary |
| topTermsJson | Text | JSON array of top n-grams |
| topEntitiesJson | Text | JSON array of top entities |
| deltaVsBaseline | Float | size / baseline_cluster_size ratio |
| examplesJson | Text | JSON array of 3 redacted example texts |

---

## IncidentBlastRadius (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| incidentId | String | FK → Incident (unique) |
| impactScore | Float | 0–100 |
| etaToCrossChannelHours | Float? | Hours until cross-channel spread |
| expectedReach24h | Float? | Estimated reach in 24h |
| expectedReach48h | Float? | Estimated reach in 48h |
| propagationPathJson | Text | JSON: channel propagation chain |
| reasonCodesJson | Text | JSON: explainability strings |

---

## IncidentNarrativeRisk (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| incidentId | String | FK → Incident (unique) |
| riskScore | Float | 0–100 |
| riskLevel | String | LOW / MED / HIGH |
| topTriggersJson | Text | JSON: matched trigger patterns |
| examplesJson | Text | JSON: 3 redacted example texts |

---

## IncidentSimulation (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| incidentId | String | FK → Incident |
| actionType | String | refunds, public_statement, recall, partner_switch, support_sla_change, do_nothing |
| seriesJson | Text | JSON: 48-point timeseries {hour, volume, negShare, trustIndex, narrativeRisk} |
| confidence | Float | 0–1 |
| matchedIncidentsJson | Text | JSON: matched historical incident IDs |

---

## IncidentSuggestedResponse (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| incidentId | String | FK → Incident |
| channel | String | Platform for response |
| taxonomy | String | Issue category |
| brandVoice | String | empathetic / professional / urgent |
| responseText | Text | Generated response |
| checklistJson | Text | JSON: [{item, required, done}] |
| redFlagsJson | Text | JSON: [{flag, reason}] |
| createdAt | DateTime | |

---

## DailyBrandHealth (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| brandId | String | Brand identifier |
| date | String | YYYY-MM-DD |
| sentimentIndex | Float | Avg sentiment (−1 to +1) |
| volume | Int | Total mention count |
| trustIndex | Float | 0–100 |
| trustBreakdownJson | Text | JSON: signal components + counts |
| narrativeRiskIndex | Float | 0–100 |
| createdAt | DateTime | |

---

## CompetitorIncident (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| competitorId | String | FK → Competitor |
| windowStart | DateTime | Detection window |
| windowEnd | DateTime | Detection window |
| summary | String | Auto summary |
| topIssuesJson | Text | JSON: issue taxonomy counts |
| riskScore | Float | 0–100 |
| createdAt | DateTime | |

---

## CompetitorOpportunity (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| brandId | String | Our brand |
| competitorId | String | FK → Competitor |
| summary | String | Opportunity description |
| recommendedAction | String | Action to take |
| evidenceJson | Text | JSON: evidence from competitor mentions |
| createdAt | DateTime | |

---

## Computed / Derived Values
| Value | Source | Range | How Computed |
|-------|--------|-------|-------------|
| sentimentScore | sentiment.ts | -1 to +1 | AFINN + rating blend |
| credibilityScore | credibility.ts | 0–100 | Channel base + 7 adjustments |
| blastRadius (mention) | credibility.ts | contained/watch/high_risk | sentiment × engagement × credibility × channels |
| trustIndex (daily) | health/trustIndex.ts | 0–100 | Weighted frequency of 5 trust signals |
| impactScore | incidents/blastRadius.ts | 0–100 | sentiment severity × velocity × channel risk × novelty |
| narrativeRiskScore | incidents/narrativeRisk.ts | 0–100 | Lexicon match density × severity weights |
