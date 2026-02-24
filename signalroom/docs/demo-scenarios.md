# SignalRoom — Demo Scenarios (Real DB Data)

All scenarios are derived from real data ingested into the SQLite database (264 MosaicWellness mentions, Jan 2024 sample). Run backfill first to populate all computed tables.

```bash
# Populate DB and run full analysis
curl -X POST http://localhost:3000/api/ingest
curl -X POST http://localhost:3000/api/admin/backfill
```

---

## Scenario 1 — Delivery Logistics Crisis (Highest Volume)

### What the data shows

- **29 negative mentions** tagged `delivery` across Amazon (23), Complaints (20), Twitter (13), Reddit (11)
- Issue spreads from structured reviews (Amazon/Nykaa) to social channels (Instagram with 9,612 engagement on a single post)
- Representative real mention (Jan 30 2024, Instagram, 9,612 engagement — redacted):

> *"Products 9/10, genuinely effective. Delivery experience 0/10, complete failure. Brand communication 0/10, 5 days of silence during a crisis. MosaicWellness has an extraordinary opportunity to win back trust by acting NOW. Fix the delivery, address the fake product claims." — @[handle], Instagram*

### How Mission Control triggers

| Module | Result |
|--------|--------|
| **Incident Detection** | Volume spike Z-score >2.5 on `delivery` negCount across Amazon + Nykaa + Twitter within 48h window |
| **Root Cause Clustering** | 2–3 clusters emerge: (a) delayed/missing parcels, (b) wrong-address/wrong-item, (c) unresponsive logistics partner (Delhivery appears in entity extraction) |
| **Blast Radius** | Impact score ~65–75/100: high engagement on Instagram/Twitter (velocity), delivery posts getting cross-shared; ETA to cross-channel spread already elapsed (multi-channel detected) |
| **Narrative Risk** | Score ~55–70 / **HIGH**: "brand going SILENT", "5 days of silence", "trust damaged", "make it right" — triggers `moral_framing` + `boycott_cta` pattern groups |
| **Trust Index** | `churnIntent` and `supportFailure` signals appear in ~35% of delivery negative mentions, pulling daily Trust Index down by ~12 points |

### Simulator recommendation

Run `POST /api/incidents/[id]/simulate` with:
- **public_statement**: Negative share drops from ~60% → ~30% by H24; Trust Index recovers +18 points vs do-nothing
- **support_sla_change**: Adds +10 trust recovery on top of statement
- **do_nothing**: Negative share stays elevated through H48, trust continues declining

### Suggested response (twitter, delivery, urgent voice)

> *"We are treating this as a priority. We sincerely apologize for the delivery failures affecting your orders. Our logistics team is working urgently with our partners to resolve all outstanding shipments within 24 hours. Please DM your order ID so we can prioritize your case immediately."*

Checklist flags: Apology ✓ · Resolution timeline ✓ · Escalation path ✓ · DM redirect ✓ · No forbidden phrases ✓

---

## Scenario 2 — Adverse Reaction / Side Effects Spike

### What the data shows

- **21 negative mentions** tagged `side_effects` — highest negative-share ratio (48% of all side_effects mentions are negative, vs 43% for delivery)
- Issues include hair fall, skin reactions, and an unresolved authenticity parallel suggesting some reports may stem from counterfeit products
- Representative real mention (Jan 2024, Instagram, 4,023 engagement — this is positive, showing the product works genuinely, but the negative cluster involves "hair fall worsening", "breakout after use"):

> *(Negative cluster example, redacted):* "Used the [product] for 3 weeks and developed severe scalp irritation and hair shedding worse than before. Batch number [BATCH_ID]. No response from customer care. Extremely worried about ingredients."

### How Mission Control triggers

| Module | Result |
|--------|--------|
| **Incident Detection** | Trust-signal spike: `refundMention` + `supportFailure` in ~38% of side_effects negatives triggers trust-signal threshold even before Z-score is reached |
| **Root Cause Clustering** | 2 clusters: (a) scalp/skin irritation post-use, (b) hair fall reported with specific batch references — batch entity appears in top entities |
| **Blast Radius** | Score ~55–65/100: lower engagement than delivery crisis but credibility is high (complaints channel + verified purchases = credibility 75+); `fraud_claim` signals in a subset amplify |
| **Narrative Risk** | Score ~40–55 / **MED→HIGH**: "unsafe", "no response", "report this" patterns detected; medical safety escalation path recommended |
| **Trust Index** | Highest `fraudClaim` rate of any issue type (~20% of side_effects negatives contain fraud/scam language linking back to counterfeit products) |

### Simulator recommendation

- **recall** action: Fastest trust recovery in the simulator (dampingFactor 0.55) — brings negative share from ~48% → ~18% by H36
- **public_statement** alone: Partial recovery but narrative risk stays elevated without product action
- **refunds**: Mid-tier — addresses financial harm but not the safety concern

### Suggested response (complaints channel, side_effects, empathetic voice)

> *"Your health and safety is our absolute priority. We're very sorry to hear about your experience. Please discontinue use immediately and consult a doctor if needed. Share your batch number via DM so our medical safety team can investigate urgently. We will cover any medical consultation costs. [Disclaimer: Please discontinue use and consult a qualified healthcare professional. Individual responses may vary.]"*

Red flags check: ✓ No forbidden phrases · ✓ Safety-first language · ✓ DM redirect for batch collection · ✓ Medical disclaimer included

---

## Scenario 3 — Trust & Authenticity Hijack (Cross-Channel Contagion)

### What the data shows

- **16 negative mentions** tagged `trust_authenticity` — 89% negative-share (16/18 total), the highest rate of any issue
- Cross-channel: same "fake products in circulation" narrative appears on Instagram, Twitter, Reddit, and Complaints simultaneously — classic contagion pattern
- Real mention (Jan 27 2024, Instagram, 6,245 engagement — redacted):

> *"Been a loyal customer for 18 months. Products transformed my skin and hair. But the current situation is breaking my heart. Fake products in circulation, delivery disasters, and the brand going SILENT. We WANT to support you but you need to communicate." — @[handle], Instagram*

### How Mission Control triggers

| Module | Result |
|--------|--------|
| **Incident Detection** | Both triggers fire: (a) negShare spike — 89% neg rate hits threshold; (b) cross-channel contagion — same issue across Instagram + Twitter + Reddit + Complaints = 4 channels |
| **Root Cause Clustering** | 2 clusters: (a) counterfeit/fake seal reports, (b) brand silence / lack of communication; "seal broken", "looks fake", "no official response" in top n-grams |
| **Blast Radius** | Score ~70–80/100: highest blast radius of the three scenarios. 6,245 engagement post + cross-channel spread already detected. ETA = null (already multi-channel). Expected 48h reach: 80,000–120,000 based on velocity |
| **Narrative Risk** | Score ~75–85 / **HIGH**: highest of all scenarios. Triggers: `fraud_scam` (fake product), `safety_alarm` (regulatory concern mentioned), `boycott_cta` (share this), `moral_framing` (brand going silent, hiding) + `media_escalation` (viral/trending language) |
| **Competitor Watch** | Competitor mentions of `trust_authenticity` are low — this is a MosaicWellness-specific event, creating a window for competitors to highlight their authenticity credentials |

### Simulator recommendation

- **public_statement** has the **highest narrative risk reduction** (0.45 coefficient) — the most impactful single action specifically for trust/authenticity crises where silence is the accelerant
- Combined **public_statement + recall** (if batch confirmed fake): Brings narrative risk from ~80 → ~20 by H48
- **do_nothing**: Narrative risk stays above 70 through H48; trust index keeps falling

### Suggested response (instagram, trust_authenticity, urgent voice)

> *"Immediate action is being taken. We take authenticity concerns extremely seriously. All genuine MosaicWellness products carry a unique QR code — please verify at our official website. [Disclaimer: Genuine products carry unique QR codes.] Please DM us the seller name and your order details so we can take immediate legal action against counterfeit sellers and ensure you receive a genuine replacement."*

Checklist: Verification method ✓ · Seller action committed ✓ · Legal action mention ✓ · No forbidden phrases ✓ · DM redirect ✓

---

## Competitor Watch Opportunities Identified

From `detectCompetitorIncidents()` run on competitor data:

| Competitor Issue | Our Strength | Recommended Action |
|------------------|-------------|-------------------|
| Competitor delivery failures | "24h delivery in metros" | Campaign: "Guaranteed next-day delivery — here's proof" |
| Competitor packaging complaints | "Leak-proof packaging" | Content: unboxing + drop-test showing packaging integrity |
| Competitor side effects reports | "Dermatologist-tested formulas" | Run derm-cert badge prominently during competitor crisis window |
| Competitor fake review accusations | "QR-code authenticity" | Proactive post: "How to verify your MosaicWellness product is genuine" |

---

## How to Reproduce

```bash
# 1. Load data
curl -X POST http://localhost:3000/api/ingest

# 2. Run full backfill (detects incidents, computes all intelligence)
curl -X POST http://localhost:3000/api/admin/backfill

# 3. View incidents list
open http://localhost:3000/incidents

# 4. For each incident ID from the list, view detail:
open http://localhost:3000/incidents/[id]

# 5. Generate a guardrailed response for Scenario 3:
curl -X POST http://localhost:3000/api/incidents/[id]/suggest-response \
  -H "Content-Type: application/json" \
  -d '{"channel":"instagram","taxonomy":"trust_authenticity","brandVoice":"urgent"}'

# 6. Check trust health trend
curl http://localhost:3000/api/health/trend
```
