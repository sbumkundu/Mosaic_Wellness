import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectAnomaly, detectCrossChannelContagion } from "@/lib/anomaly";
import { getPlaybook } from "@/lib/playbooks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "MosaicWellness";
  const windowHours = parseInt(searchParams.get("window") || "24");
  const refresh = searchParams.get("refresh") === "true";

  // Optionally refresh alerts
  if (refresh) {
    await generateAlerts(source, windowHours);
  }

  const alerts = await prisma.crisisAlert.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const enriched = await Promise.all(alerts.map(async (alert) => {
    const mentionIds = JSON.parse(alert.representativeMentionIds || "[]");
    const mentions = mentionIds.length > 0
      ? await prisma.mention.findMany({ where: { id: { in: mentionIds.slice(0, 3) } }, select: { id: true, text: true, channel: true, timestamp: true, engagement: true } })
      : [];
    const playbook = alert.issue ? getPlaybook(alert.issue) : null;
    return { ...alert, representativeMentions: mentions, playbook };
  }));

  return NextResponse.json({ alerts: enriched, count: enriched.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const source = body.source || "MosaicWellness";
  const windowHours = body.windowHours || 24;
  const count = await generateAlerts(source, windowHours);
  return NextResponse.json({ success: true, alertsGenerated: count });
}

async function generateAlerts(source: string, windowHours: number): Promise<number> {
  // Use data-relative "now": find the latest mention timestamp so sample data works regardless of actual date
  const latestMention = await prisma.mention.findFirst({
    where: { source },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });

  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const windowStart = new Date(dataEnd - windowHours * 3600000);
  const baselineStart = new Date(dataEnd - 14 * 24 * 3600000);

  // Get all mentions
  const [recentMentions, baselineMentions] = await Promise.all([
    prisma.mention.findMany({
      where: { source, timestamp: { gte: windowStart } },
      select: { id: true, channel: true, topIssue: true, product: true, sentimentScore: true, sentimentLabel: true, engagement: true, credibilityScore: true, timestamp: true, blastRadius: true },
    }),
    prisma.mention.findMany({
      where: { source, timestamp: { gte: baselineStart, lt: windowStart } },
      select: { channel: true, topIssue: true, product: true, sentimentScore: true, sentimentLabel: true, timestamp: true },
    }),
  ]);

  let alertCount = 0;

  // Deactivate old alerts
  await prisma.crisisAlert.updateMany({ where: { status: "active" }, data: { status: "resolved" } });

  // 1. Volume spike per (product, issue, channel)
  const groups = new Map<string, { recent: typeof recentMentions; baseline: typeof baselineMentions }>();

  for (const m of recentMentions) {
    const key = `${m.product || "general"}__${m.topIssue || "unknown"}__${m.channel}`;
    if (!groups.has(key)) groups.set(key, { recent: [], baseline: [] });
    groups.get(key)!.recent.push(m);
  }
  for (const m of baselineMentions) {
    const key = `${m.product || "general"}__${m.topIssue || "unknown"}__${m.channel}`;
    if (!groups.has(key)) groups.set(key, { recent: [], baseline: [] });
    groups.get(key)!.baseline.push(m);
  }

  for (const [key, { recent, baseline }] of Array.from(groups)) {
    if (recent.length < 3) continue;
    const [product, issue, channel] = key.split("__");

    // Build time series (hourly buckets)
    const toHourlyPoints = (mentions: Array<{ timestamp: Date | string; sentimentScore: number; sentimentLabel: string }>) => {
      const hourMap = new Map<string, { count: number; negCount: number; avgSentiment: number; totalEngagement: number }>();
      for (const m of mentions) {
        const h = new Date(m.timestamp);
        h.setMinutes(0, 0, 0);
        const k = h.toISOString();
        if (!hourMap.has(k)) hourMap.set(k, { count: 0, negCount: 0, avgSentiment: 0, totalEngagement: 0 });
        const cell = hourMap.get(k)!;
        cell.count++;
        if (m.sentimentLabel === "neg") cell.negCount++;
        cell.avgSentiment = (cell.avgSentiment * (cell.count - 1) + m.sentimentScore) / cell.count;
      }
      return Array.from(hourMap.entries()).map(([hour, v]) => ({ hour, ...v }));
    };

    const baselinePts = toHourlyPoints(baseline);
    const recentPts = toHourlyPoints(recent);

    const anomaly = detectAnomaly(baselinePts, recentPts, "negCount");

    if (anomaly.isAnomaly && anomaly.magnitude > 1.5) {
      const repIds = [...recent]
        .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
        .slice(0, 5)
        .map((m) => m.id);

      const highReach = recent.some(m => m.blastRadius === "high_risk" || (m.engagement || 0) > 100);
      const blastRadius = highReach ? "high_risk" : anomaly.magnitude > 3 ? "watch" : "contained";

      await prisma.crisisAlert.create({
        data: {
          type: "volume_spike",
          product: product !== "general" ? product : null,
          channel: channel !== "unknown" ? channel : null,
          issue: issue !== "unknown" ? issue : null,
          magnitude: Math.round(anomaly.magnitude * 10) / 10,
          confidence: Math.round(anomaly.confidence * 100) / 100,
          blastRadius,
          since: windowStart,
          representativeMentionIds: JSON.stringify(repIds),
          status: "active",
          summary: `${issue} complaints on ${channel} for ${product} spiked ${anomaly.magnitude.toFixed(1)}x vs baseline (z=${anomaly.zScore.toFixed(1)})`,
          playbook: issue && getPlaybook(issue) ? JSON.stringify(getPlaybook(issue)) : null,
        },
      });
      alertCount++;
    }
  }

  // 2. Cross-channel contagion
  const contagions = detectCrossChannelContagion(
    recentMentions.map(m => ({ channel: m.channel, timestamp: new Date(m.timestamp), topIssue: m.topIssue })),
    windowHours
  );

  for (const c of contagions) {
    if (c.channels.length < 2) continue;
    const relatedMentions = recentMentions
      .filter(m => m.topIssue === c.issue && c.channels.includes(m.channel))
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 5);

    await prisma.crisisAlert.create({
      data: {
        type: "cross_channel",
        issue: c.issue,
        magnitude: c.channels.length,
        confidence: 0.85,
        blastRadius: c.channels.length >= 3 ? "high_risk" : "watch",
        since: c.firstSeen,
        representativeMentionIds: JSON.stringify(relatedMentions.map(m => m.id)),
        status: "active",
        summary: `${c.issue} complaints detected across ${c.channels.join(", ")} — cross-channel contagion signal`,
        playbook: getPlaybook(c.issue) ? JSON.stringify(getPlaybook(c.issue)) : null,
      },
    });
    alertCount++;
  }

  // 3. High-reach risk items
  const highReachItems = recentMentions.filter(m => m.blastRadius === "high_risk" || (m.engagement || 0) > 200);
  if (highReachItems.length > 0) {
    const topItem = highReachItems.sort((a, b) => (b.engagement || 0) - (a.engagement || 0))[0];
    await prisma.crisisAlert.create({
      data: {
        type: "high_reach",
        channel: topItem.channel,
        issue: topItem.topIssue || undefined,
        magnitude: topItem.engagement || 0,
        confidence: 0.75,
        blastRadius: "high_risk",
        since: new Date(topItem.timestamp),
        representativeMentionIds: JSON.stringify(highReachItems.slice(0, 5).map(m => m.id)),
        status: "active",
        summary: `High-reach negative item on ${topItem.channel} with ${topItem.engagement} engagements`,
      },
    });
    alertCount++;
  }

  // 4. Early Warning: rising velocity not yet at spike threshold (predicts crisis 24-48h out)
  // Split recent window: last 6h vs prior 18h — flag if acceleration is 1.3x–2.4x
  const earlyWarnStart = new Date(dataEnd - 6 * 3600000);

  const ewGroups = new Map<string, {
    last6h: typeof recentMentions;
    prev18h: typeof recentMentions;
    baseline: typeof baselineMentions;
  }>();

  for (const m of recentMentions) {
    const key = `${m.product || "general"}__${m.topIssue || "unknown"}__${m.channel}`;
    if (!ewGroups.has(key)) ewGroups.set(key, { last6h: [], prev18h: [], baseline: [] });
    const ts = new Date(m.timestamp).getTime();
    if (ts >= earlyWarnStart.getTime()) {
      ewGroups.get(key)!.last6h.push(m);
    } else {
      ewGroups.get(key)!.prev18h.push(m);
    }
  }
  for (const m of baselineMentions) {
    const key = `${m.product || "general"}__${m.topIssue || "unknown"}__${m.channel}`;
    if (ewGroups.has(key)) ewGroups.get(key)!.baseline.push(m);
  }

  for (const [key, { last6h, prev18h, baseline }] of Array.from(ewGroups)) {
    const [product, issue, channel] = key.split("__");
    if (last6h.length < 2) continue;

    const last6hNeg = last6h.filter(m => m.sentimentLabel === "neg").length;
    const prev18hNeg = prev18h.filter(m => m.sentimentLabel === "neg").length;
    const last6hRate = last6hNeg / 6; // negative mentions per hour
    const prev18hRate = prev18h.length > 0 ? prev18hNeg / 18 : 0;

    if (last6hRate === 0) continue;

    const velocityRatio = prev18hRate > 0 ? last6hRate / prev18hRate : (last6hNeg >= 2 ? 1.8 : 0);
    if (velocityRatio < 1.3 || velocityRatio >= 2.5) continue; // outside early warning band

    // Compute baseline daily rate for ETA estimation
    const baselineNeg = baseline.filter(m => m.sentimentLabel === "neg").length;
    const baselineRate = baselineNeg / (13 * 24); // per hour over 13 days
    const spikeThresholdRate = Math.max(baselineRate * 2.5, last6hRate * 1.5);

    // ETA: linear extrapolation based on hourly acceleration
    const hourlyAcceleration = (last6hRate - prev18hRate) / 12;
    let etaHours: number;
    if (hourlyAcceleration > 0) {
      etaHours = Math.ceil((spikeThresholdRate - last6hRate) / hourlyAcceleration);
      etaHours = Math.max(6, Math.min(48, etaHours));
    } else {
      etaHours = 36; // stable rising — default 36h estimate
    }

    const confidence = Math.min(0.72, 0.35 + velocityRatio * 0.12);
    const repIds = last6h
      .filter(m => m.sentimentLabel === "neg")
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 5)
      .map(m => m.id);

    await prisma.crisisAlert.create({
      data: {
        type: "early_warning",
        product: product !== "general" ? product : null,
        channel: channel !== "unknown" ? channel : null,
        issue: issue !== "unknown" ? issue : null,
        magnitude: Math.round(velocityRatio * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        blastRadius: velocityRatio >= 2.0 ? "watch" : "contained",
        since: earlyWarnStart,
        representativeMentionIds: JSON.stringify(repIds),
        status: "active",
        summary: `Velocity rising ${velocityRatio.toFixed(1)}× on ${channel} for ${issue} — est. ${etaHours}h to spike threshold`,
        playbook: issue && getPlaybook(issue) ? JSON.stringify(getPlaybook(issue)) : null,
      },
    });
    alertCount++;
  }

  return alertCount;
}
