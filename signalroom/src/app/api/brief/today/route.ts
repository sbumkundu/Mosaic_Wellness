import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "MosaicWellness";
  const today = new Date().toISOString().slice(0, 10);

  // Return cached brief if exists
  const cached = await prisma.dailyBrief.findUnique({ where: { date: today } });
  if (cached) {
    return NextResponse.json({ ...JSON.parse(cached.content), date: today, cached: true });
  }

  // Generate fresh brief (data-relative dates so sample data from any year works)
  const latestMention = await prisma.mention.findFirst({ where: { source }, orderBy: { timestamp: "desc" }, select: { timestamp: true } });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const since24h = new Date(dataEnd - 24 * 3600000);
  const since7d = new Date(dataEnd - 7 * 24 * 3600000);

  const [recent24h, recent7d, activeAlerts, competitors] = await Promise.all([
    prisma.mention.findMany({
      where: { source, timestamp: { gte: since24h } },
      select: { sentimentScore: true, sentimentLabel: true, topIssue: true, engagement: true, credibilityScore: true },
    }),
    prisma.mention.findMany({
      where: { source, timestamp: { gte: since7d } },
      select: { sentimentScore: true, sentimentLabel: true, topIssue: true },
    }),
    prisma.crisisAlert.findMany({ where: { status: "active" }, orderBy: { magnitude: "desc" }, take: 3 }),
    prisma.competitor.findMany(),
  ]);

  type R24 = (typeof recent24h)[number];
  type R7 = (typeof recent7d)[number];
  const avgSentiment24h = recent24h.length > 0 ? recent24h.reduce((s: number, m: R24) => s + m.sentimentScore, 0) / recent24h.length : 0;
  const avgSentiment7d = recent7d.length > 0 ? recent7d.reduce((s: number, m: R7) => s + m.sentimentScore, 0) / recent7d.length : 0;
  const healthScore = Math.round(50 + avgSentiment24h * 30 - (recent24h.filter(m => m.sentimentLabel === "neg").length / Math.max(recent24h.length, 1)) * 25);
  const trend = avgSentiment24h > avgSentiment7d + 0.05 ? "improving" : avgSentiment24h < avgSentiment7d - 0.05 ? "declining" : "stable";

  // Top issue
  const issueCounts = new Map<string, number>();
  for (const m of recent24h) {
    if (m.topIssue) issueCounts.set(m.topIssue, (issueCounts.get(m.topIssue) || 0) + 1);
  }
  const topIssueEntry = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const topIssue = topIssueEntry?.[0] || "no clear issue";
  const topIssuePct = topIssueEntry ? Math.round(topIssueEntry[1] / recent24h.length * 100) : 0;

  // Competitor comparison
  const compMentions = competitors.length > 0
    ? await prisma.mention.findMany({
        where: { source: { in: competitors.map(c => c.name) }, timestamp: { gte: since7d } },
        select: { source: true, sentimentScore: true },
      })
    : [];
  
  let compComparison = "No competitor data available.";
  if (compMentions.length > 0) {
    const compAvg = compMentions.reduce((s: number, m: (typeof compMentions)[number]) => s + m.sentimentScore, 0) / compMentions.length;
    const compDiff = avgSentiment7d - compAvg;
    if (compDiff > 0.1) {
      compComparison = `Brand sentiment is +${(compDiff * 100).toFixed(0)}pts above competitor average, led by ${competitors[0]?.name || "competition"}.`;
    } else if (compDiff < -0.1) {
      compComparison = `Brand sentiment is ${(Math.abs(compDiff) * 100).toFixed(0)}pts below competitor average — ${competitors[0]?.name || "key competitors"} are outperforming.`;
    } else {
      compComparison = `Brand sentiment is on par with competitors (±${(Math.abs(compDiff) * 100).toFixed(0)}pts), with no clear differentiation.`;
    }
  }

  // Recommended actions
  const actions: string[] = [];
  if (topIssue === "delivery") actions.push("Audit Delhivery/logistics SLA for last 48h orders; consider proactive refund for delayed orders");
  if (topIssue === "side_effects") actions.push("Flag to Medical Safety team immediately; prepare customer safety messaging");
  if (topIssue === "trust_authenticity") actions.push("Escalate to Brand Protection team; issue QR verification reminder across channels");
  if (topIssue === "product_quality") actions.push("Pull QA data for flagged batches; engage with top negative reviewers");
  if (activeAlerts.length > 0) actions.push(`Address ${activeAlerts.length} active crisis alert(s) — check Incident Room for playbooks`);
  if (actions.length === 0) actions.push("Monitor metrics; respond to top negative reviews within 24h", "Share positive UGC across social channels to boost brand perception");

  const sentences = [
    `Brand health score is ${healthScore}/100 and ${trend} over the past 24h (avg sentiment: ${avgSentiment24h > 0 ? "+" : ""}${(avgSentiment24h * 100).toFixed(0)}pts).`,
    `Top issue driver today is "${topIssue}" at ${topIssuePct}% of negative mentions — ${recent24h.filter(m => m.topIssue === topIssue).length} mentions in last 24h.`,
    activeAlerts.length > 0
      ? `Emerging risk: ${activeAlerts[0].summary || `${activeAlerts[0].type} on ${activeAlerts[0].channel}`} — ${activeAlerts[0].blastRadius.replace("_", " ")} blast radius.`
      : `No active crisis alerts — system is in monitoring mode; watch for delivery spike signals.`,
    compComparison,
    `Recommended actions: (1) ${actions[0] || "Review and respond to top negative reviews"} — (2) ${actions[1] || "Monitor sentiment trend over next 12 hours"}.`,
  ];

  const brief = {
    healthScore,
    trend,
    avgSentiment: Math.round(avgSentiment24h * 100) / 100,
    topIssue,
    topIssuePct,
    activeAlerts: activeAlerts.length,
    sentences,
    actions: actions.slice(0, 4),
    generatedAt: new Date().toISOString(),
  };

  // Cache it
  await prisma.dailyBrief.upsert({
    where: { date: today },
    update: { content: JSON.stringify(brief) },
    create: { date: today, content: JSON.stringify(brief) },
  });

  return NextResponse.json({ ...brief, date: today, cached: false });
}
