// Incident detection: volume z-score / negative-share / trust-signal spikes
// Produces Incident rows linked to underlying Mention data.

import { prisma } from "@/lib/db";
import { detectAnomaly } from "@/lib/anomaly";

export interface DetectOptions {
  brandId: string;       // e.g. "MosaicWellness"
  windowHours?: number;  // recent window to check (default 48)
  baselineDays?: number; // baseline lookback (default 7)
  dryRun?: boolean;      // if true, return results without persisting
}

export interface DetectedIncident {
  id: string;
  brandId: string;
  productId: string | null;
  title: string;
  status: string;
  severity: string;
  windowStart: Date;
  windowEnd: Date;
  baselineStart: Date;
  baselineEnd: Date;
  primaryChannel: string | null;
  summary: string;
  created: boolean; // true = new row, false = already existed
}

// Severity mapping from magnitude
function severityFromMagnitude(magnitude: number): string {
  if (magnitude >= 4) return "critical";
  if (magnitude >= 2.5) return "high";
  if (magnitude >= 1.5) return "medium";
  return "low";
}

export async function detectIncidents(opts: DetectOptions): Promise<DetectedIncident[]> {
  const {
    brandId,
    windowHours = 48,
    baselineDays = 7,
    dryRun = false,
  } = opts;

  // Anchor all windows to latest mention timestamp (data-relative)
  const latestMention = await prisma.mention.findFirst({
    where: { source: brandId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  if (!latestMention) return [];

  const dataEnd = new Date(latestMention.timestamp);
  const windowStart = new Date(dataEnd.getTime() - windowHours * 3_600_000);
  const baselineStart = new Date(dataEnd.getTime() - baselineDays * 24 * 3_600_000);

  // Pull aggregates for the window and baseline
  const windowAggs = await prisma.hourlyAggregate.findMany({
    where: {
      source: brandId,
      hour: { gte: windowStart.toISOString(), lte: dataEnd.toISOString() },
    },
  });

  const baselineAggs = await prisma.hourlyAggregate.findMany({
    where: {
      source: brandId,
      hour: { gte: baselineStart.toISOString(), lt: windowStart.toISOString() },
    },
  });

  // Group by (product, issue, channel)
  type AggKey = string;
  type AggEntry = {
    product: string; issue: string; channel: string;
    windowPoints: typeof windowAggs;
    baselinePoints: typeof baselineAggs;
  };

  const grouped = new Map<AggKey, AggEntry>();

  for (const row of windowAggs) {
    const key = `${row.product}|${row.issue}|${row.channel}`;
    if (!grouped.has(key)) {
      grouped.set(key, { product: row.product, issue: row.issue, channel: row.channel, windowPoints: [], baselinePoints: [] });
    }
    grouped.get(key)!.windowPoints.push(row);
  }
  for (const row of baselineAggs) {
    const key = `${row.product}|${row.issue}|${row.channel}`;
    if (!grouped.has(key)) {
      grouped.set(key, { product: row.product, issue: row.issue, channel: row.channel, windowPoints: [], baselinePoints: [] });
    }
    grouped.get(key)!.baselinePoints.push(row);
  }

  const results: DetectedIncident[] = [];

  for (const [, entry] of Array.from(grouped)) {
    const { product, issue, channel, windowPoints, baselinePoints } = entry;
    if (windowPoints.length === 0) continue;

    // Map to TimeSeriesPoint shape expected by detectAnomaly
    const bpMapped = baselinePoints.map(r => ({
      hour: r.hour,
      count: r.count,
      negCount: r.negCount,
      avgSentiment: r.avgSentiment,
      totalEngagement: r.totalEngagement,
    }));
    const wpMapped = windowPoints.map(r => ({
      hour: r.hour,
      count: r.count,
      negCount: r.negCount,
      avgSentiment: r.avgSentiment,
      totalEngagement: r.totalEngagement,
    }));

    // Need at least some baseline; fall back to a minimum threshold check
    const anomaly = detectAnomaly(bpMapped, wpMapped, "negCount");
    const windowNeg = windowPoints.reduce((s, r) => s + r.negCount, 0);
    const windowTotal = windowPoints.reduce((s, r) => s + r.count, 0);
    const negShare = windowTotal > 0 ? windowNeg / windowTotal : 0;

    // Also check trust-signal spike in window mentions
    const windowMentions = await prisma.mention.findMany({
      where: {
        source: brandId,
        channel,
        topIssue: issue,
        timestamp: { gte: windowStart, lte: dataEnd },
      },
      select: { refundMention: true, fakeClaim: true, churnIntent: true, supportFailure: true, fraudClaim: true, sentimentScore: true },
    });

    const trustSignalCount = windowMentions.filter(
      m => m.refundMention || m.fakeClaim || m.churnIntent || m.supportFailure || m.fraudClaim
    ).length;
    const trustSignalRate = windowMentions.length > 0 ? trustSignalCount / windowMentions.length : 0;

    // Trigger conditions
    const triggerVolume = anomaly.isAnomaly && anomaly.magnitude >= 1.5;
    const triggerNegShare = negShare >= 0.6 && windowNeg >= 3;
    const triggerTrust = trustSignalRate >= 0.3 && trustSignalCount >= 2;

    if (!triggerVolume && !triggerNegShare && !triggerTrust) continue;

    const magnitude = Math.max(anomaly.magnitude, negShare * 3);
    const severity = severityFromMagnitude(magnitude);

    // Build title
    const triggerType = triggerVolume ? "Volume Spike" : triggerNegShare ? "Negative Share Spike" : "Trust Signal Spike";
    const title = `${triggerType}: ${issue.replace(/_/g, " ")} on ${channel}` +
      (product && product !== "unknown" ? ` (${product})` : "");

    const summary =
      `Detected ${triggerType.toLowerCase()} for "${issue.replace(/_/g, " ")}" on ${channel}` +
      (product && product !== "unknown" ? ` for product "${product}"` : "") +
      `. Window: ${windowNeg} negative / ${windowTotal} total (${Math.round(negShare * 100)}% neg share).` +
      (anomaly.isAnomaly ? ` Z-score: ${anomaly.zScore.toFixed(1)}, magnitude: ${anomaly.magnitude.toFixed(1)}×.` : "") +
      (triggerTrust ? ` Trust signals: ${trustSignalCount} mentions flagged.` : "");

    // Deduplicate: check if active incident already covers this window+product+issue+channel
    const existing = await prisma.incident.findFirst({
      where: {
        brandId,
        productId: product !== "unknown" ? product : null,
        status: { in: ["active", "investigating"] },
        primaryChannel: channel,
        summary: { contains: issue },
        windowStart: { gte: new Date(windowStart.getTime() - 12 * 3_600_000) },
      },
    });

    if (existing) {
      results.push({
        id: existing.id,
        brandId,
        productId: existing.productId,
        title: existing.title,
        status: existing.status,
        severity: existing.severity,
        windowStart,
        windowEnd: dataEnd,
        baselineStart,
        baselineEnd: windowStart,
        primaryChannel: channel,
        summary,
        created: false,
      });
      continue;
    }

    const incidentData = {
      brandId,
      productId: product !== "unknown" ? product : null,
      title,
      status: "active",
      severity,
      windowStart,
      windowEnd: dataEnd,
      baselineStart,
      baselineEnd: windowStart,
      primaryChannel: channel,
      summary,
    };

    let id: string;
    if (!dryRun) {
      const created = await prisma.incident.create({ data: incidentData });
      id = created.id;
    } else {
      id = crypto.randomUUID();
    }

    results.push({ ...incidentData, id, created: true });
  }

  // Sort by severity desc
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results.sort((a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 3));

  return results;
}
