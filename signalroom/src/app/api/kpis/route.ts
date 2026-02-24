import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function computeHealthScore(
  avgSentiment: number,
  negRatio: number,
  credibilityWeightedSentiment: number
): number {
  // Score 0-100, 50 = neutral
  const sentimentComponent = (credibilityWeightedSentiment + 1) / 2 * 50;
  const negPenalty = negRatio * 30;
  return Math.round(Math.max(0, Math.min(100, 50 + sentimentComponent - negPenalty)));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "MosaicWellness";
  const rangeHours = parseInt(searchParams.get("hours") || "24");

  // Use data-relative "now" so sample data from any date works
  const latestMention = await prisma.mention.findFirst({
    where: { source },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();

  const since = new Date(dataEnd - rangeHours * 60 * 60 * 1000);
  const prev = new Date(dataEnd - rangeHours * 2 * 60 * 60 * 1000);

  const [allMentions, recentMentions, prevMentions, activeAlerts, totalCount] = await Promise.all([
    prisma.mention.findMany({
      where: { source, timestamp: { gte: since } },
      select: { sentimentScore: true, sentimentLabel: true, topIssue: true, credibilityScore: true, channel: true, language: true },
    }),
    prisma.mention.count({ where: { source, timestamp: { gte: since } } }),
    prisma.mention.count({ where: { source, timestamp: { gte: prev, lt: since } } }),
    prisma.crisisAlert.count({ where: { status: "active" } }),
    prisma.mention.count({ where: { source } }),
  ]);

  const negMentions = allMentions.filter(m => m.sentimentLabel === "neg");
  const negVolume = negMentions.length;
  const negRatio = allMentions.length > 0 ? negVolume / allMentions.length : 0;

  // Credibility-weighted sentiment
  type MRow = (typeof allMentions)[number];
  const weightedSentiment = allMentions.length > 0
    ? allMentions.reduce((s: number, m: MRow) => s + m.sentimentScore * (m.credibilityScore / 100), 0) / allMentions.length
    : 0;
  const avgSentiment = allMentions.length > 0
    ? allMentions.reduce((s: number, m: MRow) => s + m.sentimentScore, 0) / allMentions.length
    : 0;

  const healthScore = computeHealthScore(avgSentiment, negRatio, weightedSentiment);

  // Top issues
  const issueCounts = new Map<string, number>();
  for (const m of allMentions) {
    if (m.topIssue) issueCounts.set(m.topIssue, (issueCounts.get(m.topIssue) || 0) + 1);
  }
  const topIssues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count, pct: Math.round(count / allMentions.length * 100) }));

  // Channel breakdown
  const channelCounts = new Map<string, number>();
  for (const m of allMentions) {
    channelCounts.set(m.channel, (channelCounts.get(m.channel) || 0) + 1);
  }
  const channelBreakdown = Array.from(channelCounts.entries()).map(([channel, count]) => ({ channel, count }));

  // Language breakdown
  const langCounts = new Map<string, number>();
  for (const m of allMentions) {
    langCounts.set(m.language, (langCounts.get(m.language) || 0) + 1);
  }
  const languages = Array.from(langCounts.entries()).map(([lang, count]) => ({ lang, count }));

  const volumeChange = prevMentions > 0 ? ((recentMentions - prevMentions) / prevMentions) * 100 : 0;

  return NextResponse.json({
    healthScore,
    avgSentiment: Math.round(avgSentiment * 100) / 100,
    weightedSentiment: Math.round(weightedSentiment * 100) / 100,
    negVolume,
    negRatio: Math.round(negRatio * 100),
    totalMentions: recentMentions,
    totalAllTime: totalCount,
    volumeChange: Math.round(volumeChange),
    activeAlerts,
    topIssues,
    channelBreakdown,
    languages,
    rangeHours,
  });
}
