// Root-cause clustering + attribution for an Incident
// Uses TF-IDF n-gram clustering (no external vector DB) with attribution breakdown.

import { prisma } from "@/lib/db";

// ── Tokenisation & TF-IDF ────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "this", "that", "with", "from", "they", "have", "been", "were", "will",
  "would", "could", "should", "their", "there", "about", "which", "what",
  "when", "where", "very", "just", "also", "your", "product", "brand",
  "mosaic", "wellness", "mosaicwellness", "ordered", "order", "received",
  "thank", "please", "good", "great", "really", "much", "like", "time",
  "still", "never", "always", "every", "after", "before", "using", "used",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [k, v] of Array.from(tf)) tf.set(k, v / tokens.length);
  return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const [k, v] of Array.from(a)) { dot += v * (b.get(k) || 0); magA += v * v; }
  for (const [, v] of Array.from(b)) magB += v * v;
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function topNgrams(texts: string[], n = 10): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tokens = tokenize(text);
    // Unigrams
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
    // Bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = `${tokens[i]} ${tokens[i + 1]}`;
      counts.set(bg, (counts.get(bg) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term]) => term);
}

// Redact PII patterns from example text
function redactText(text: string): string {
  return text
    .replace(/\b[A-Z]{2,4}[\d]{6,12}\b/g, "[ORDER_ID]")        // order IDs
    .replace(/\b\d{10}\b/g, "[PHONE]")                            // 10-digit phone
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]") // email
    .replace(/\b[A-Z]{2,4}[0-9]{6,15}\b/g, "[TRACKING_ID]");     // tracking numbers
}

// ── Baseline cluster delta ───────────────────────────────────────────────────

async function getBaselineClusterSize(
  source: string,
  issue: string,
  channel: string,
  baselineStart: Date,
  baselineEnd: Date,
): Promise<number> {
  const count = await prisma.mention.count({
    where: {
      source,
      topIssue: issue,
      channel,
      timestamp: { gte: baselineStart, lte: baselineEnd },
    },
  });
  // Normalise to per-48h rate
  const days = (baselineEnd.getTime() - baselineStart.getTime()) / 86_400_000;
  return days > 0 ? (count / days) * 2 : count;
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface RootCauseCluster {
  clusterKey: string;
  size: number;
  summary: string;
  topTerms: string[];
  topEntities: string[];
  deltaVsBaseline: number;
  examples: string[]; // redacted
}

export async function computeRootCause(incidentId: string): Promise<RootCauseCluster[]> {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return [];

  // Fetch window mentions
  const mentions = await prisma.mention.findMany({
    where: {
      source: incident.brandId,
      timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
      ...(incident.primaryChannel ? { channel: incident.primaryChannel } : {}),
    },
    select: {
      id: true, text: true, topIssue: true, channel: true,
      location: true, deliveryPartner: true, entities: true,
      sentimentScore: true,
    },
    take: 300,
  });

  if (mentions.length === 0) return [];

  // Compute TF vectors
  const vecs = mentions.map(m => ({
    id: m.id,
    text: m.text,
    tokens: tokenize(m.text),
    tf: computeTF(tokenize(m.text)),
    topIssue: m.topIssue,
    channel: m.channel,
    location: m.location,
    deliveryPartner: m.deliveryPartner,
    entities: (() => { try { return JSON.parse(m.entities); } catch { return {}; } })(),
  }));

  // Greedy clustering (same threshold as existing clustering.ts)
  const assigned = new Set<string>();
  const clusters: Array<{ items: typeof vecs }> = [];

  for (let i = 0; i < vecs.length; i++) {
    if (assigned.has(vecs[i].id)) continue;
    const cluster = [vecs[i]];
    assigned.add(vecs[i].id);

    for (let j = i + 1; j < vecs.length; j++) {
      if (assigned.has(vecs[j].id)) continue;
      const sameIssue = vecs[i].topIssue === vecs[j].topIssue ? 0.15 : 0;
      const sim = cosineSimilarity(vecs[i].tf, vecs[j].tf) + sameIssue;
      if (sim >= 0.25) {
        cluster.push(vecs[j]);
        assigned.add(vecs[j].id);
      }
    }
    clusters.push({ items: cluster });
  }

  // Sort by size desc, keep top 6
  clusters.sort((a, b) => b.items.length - a.items.length);
  const topClusters = clusters.slice(0, 6).filter(c => c.items.length >= 2);

  // Build baseline lookup for delta
  const baselineSize = await getBaselineClusterSize(
    incident.brandId,
    mentions[0]?.topIssue || "",
    incident.primaryChannel || "",
    incident.baselineStart,
    incident.baselineEnd,
  );

  const results: RootCauseCluster[] = [];

  for (let ci = 0; ci < topClusters.length; ci++) {
    const cluster = topClusters[ci];
    const texts = cluster.items.map(i => i.text);
    const topTerms = topNgrams(texts, 8);

    // Top entities across cluster
    const entityCounts = new Map<string, number>();
    for (const item of cluster.items) {
      const ents = item.entities as Record<string, unknown>;
      // Locations
      const locs = (ents.locations as Array<{ name: string }> | undefined) || [];
      for (const l of locs) entityCounts.set(l.name, (entityCounts.get(l.name) || 0) + 1);
      // Delivery partners
      const dps = (ents.deliveryPartners as Array<{ name: string }> | undefined) || [];
      for (const d of dps) entityCounts.set(d.name, (entityCounts.get(d.name) || 0) + 1);
      // Products
      const prods = (ents.products as Array<{ name: string }> | undefined) || [];
      for (const p of prods) entityCounts.set(p.name, (entityCounts.get(p.name) || 0) + 1);
    }
    const topEntities = Array.from(entityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Delta vs baseline (cluster size / expected per-48h baseline)
    const delta = baselineSize > 0 ? cluster.items.length / baselineSize : cluster.items.length > 0 ? 3 : 1;

    // Redacted examples (up to 3)
    const examples = cluster.items
      .sort((a, b) => (b.entities?.engagement || 0) - (a.entities?.engagement || 0))
      .slice(0, 3)
      .map(i => redactText(i.text).slice(0, 200));

    // Cluster summary
    const dominantIssue = cluster.items[0]?.topIssue?.replace(/_/g, " ") || "mixed";
    const summary = `Cluster ${ci + 1}: ${cluster.items.length} mentions about "${dominantIssue}". ` +
      (topTerms.length > 0 ? `Key themes: ${topTerms.slice(0, 3).join(", ")}.` : "") +
      (delta > 2 ? ` Volume is ${delta.toFixed(1)}× above baseline.` : "");

    const clusterKey = `${incidentId}-cluster-${ci}`;
    results.push({ clusterKey, size: cluster.items.length, summary, topTerms, topEntities, deltaVsBaseline: delta, examples });
  }

  // Persist to DB (upsert by incidentId+clusterKey via delete+create for simplicity)
  if (results.length > 0) {
    await prisma.incidentCluster.deleteMany({ where: { incidentId } });
    await prisma.incidentCluster.createMany({
      data: results.map(r => ({
        incidentId,
        clusterKey: r.clusterKey,
        size: r.size,
        summary: r.summary,
        topTermsJson: JSON.stringify(r.topTerms),
        topEntitiesJson: JSON.stringify(r.topEntities),
        deltaVsBaseline: r.deltaVsBaseline,
        examplesJson: JSON.stringify(r.examples),
      })),
    });
  }

  return results;
}

// Attribution: location / delivery partner / channel breakdown
export interface Attribution {
  locations: Array<{ name: string; count: number; pct: number }>;
  deliveryPartners: Array<{ name: string; count: number; pct: number }>;
  channels: Array<{ name: string; count: number; pct: number }>;
}

export async function computeAttribution(incidentId: string): Promise<Attribution> {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return { locations: [], deliveryPartners: [], channels: [] };

  const mentions = await prisma.mention.findMany({
    where: {
      source: incident.brandId,
      timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
    },
    select: { location: true, deliveryPartner: true, channel: true },
    take: 500,
  });

  const total = mentions.length || 1;

  const tally = <T extends string | null>(field: (m: typeof mentions[0]) => T) => {
    const counts = new Map<string, number>();
    for (const m of mentions) {
      const val = field(m);
      if (val) counts.set(val, (counts.get(val) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
  };

  return {
    locations: tally(m => m.location),
    deliveryPartners: tally(m => m.deliveryPartner),
    channels: tally(m => m.channel),
  };
}
