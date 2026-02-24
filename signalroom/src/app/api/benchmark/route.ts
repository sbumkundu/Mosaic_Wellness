import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ISSUE_WEIGHTS: Record<string, number> = {
  trust_authenticity: 3.0,
  side_effects: 2.5,
  product_quality: 2.0,
  delivery: 1.5,
  packaging: 1.2,
  support: 1.0,
  pricing: 0.8,
};

function computeBrandHealthScore(
  avgSentiment: number,
  negRatio: number,
  topIssue: string | null,
  avgEngagement: number
): number {
  let score = 50 + avgSentiment * 30;
  score -= negRatio * 25;
  
  if (topIssue && ISSUE_WEIGHTS[topIssue]) {
    score -= (ISSUE_WEIGHTS[topIssue] - 1) * 5;
  }
  
  // Reach weighting (negative)
  if (avgEngagement > 100) score -= 5;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const myBrand = searchParams.get("source") || "MosaicWellness";
  const days = parseInt(searchParams.get("days") || "14");

  const latestMention = await prisma.mention.findFirst({ where: { source: myBrand }, orderBy: { timestamp: "desc" }, select: { timestamp: true } });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const since = new Date(dataEnd - days * 24 * 3600000);

  const competitors = await prisma.competitor.findMany();
  const brands = [{ name: myBrand, brand: myBrand }, ...competitors];

  const brandData = await Promise.all(brands.map(async (brand) => {
    const mentions = await prisma.mention.findMany({
      where: { source: brand.name, timestamp: { gte: since } },
      select: { timestamp: true, sentimentScore: true, sentimentLabel: true, topIssue: true, engagement: true, channel: true },
    });

    if (mentions.length === 0) {
      return {
        brand: brand.name,
        healthScore: 50,
        avgSentiment: 0,
        negRatio: 0,
        topIssue: null,
        mentionCount: 0,
        dailyScores: [],
        channelBreakdown: [],
        topDifferentiatingIssue: null,
      };
    }

    type MentionRow = (typeof mentions)[number];
    const avgSentiment = mentions.reduce((s: number, m: MentionRow) => s + m.sentimentScore, 0) / mentions.length;
    const negRatio = mentions.filter((m: MentionRow) => m.sentimentLabel === "neg").length / mentions.length;
    const avgEngagement = mentions.reduce((s: number, m: MentionRow) => s + m.engagement, 0) / mentions.length;

    const issueCounts = new Map<string, number>();
    for (const m of mentions) {
      if (m.topIssue) issueCounts.set(m.topIssue, (issueCounts.get(m.topIssue) || 0) + 1);
    }
    const topIssue = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const healthScore = computeBrandHealthScore(avgSentiment, negRatio, topIssue, avgEngagement);

    // Daily scores for trend chart
    const dailyMap = new Map<string, { sentimentSum: number; count: number; negCount: number }>();
    for (const m of mentions) {
      const day = new Date(m.timestamp).toISOString().slice(0, 10);
      if (!dailyMap.has(day)) dailyMap.set(day, { sentimentSum: 0, count: 0, negCount: 0 });
      const d = dailyMap.get(day)!;
      d.sentimentSum += m.sentimentScore;
      d.count++;
      if (m.sentimentLabel === "neg") d.negCount++;
    }
    const dailyScores = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        score: computeBrandHealthScore(d.sentimentSum / d.count, d.negCount / d.count, topIssue, avgEngagement),
      }));

    // Channel breakdown
    const channelCounts = new Map<string, number>();
    for (const m of mentions) {
      channelCounts.set(m.channel, (channelCounts.get(m.channel) || 0) + 1);
    }
    const channelBreakdown = Array.from(channelCounts.entries()).map(([channel, count]) => ({ channel, count }));

    return {
      brand: brand.name,
      healthScore,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      negRatio: Math.round(negRatio * 100),
      topIssue,
      mentionCount: mentions.length,
      dailyScores,
      channelBreakdown,
    };
  }));

  // Find differentiating issue (where MosaicWellness is worse than avg competitors)
  const myData = brandData.find(b => b.brand === myBrand);
  const compData = brandData.filter(b => b.brand !== myBrand);
  
  let topDifferentiatingIssue = null;
  if (myData && compData.length > 0) {
    const myScore = myData.healthScore;
    const avgCompScore = compData.reduce((s, b) => s + b.healthScore, 0) / compData.length;
    if (myScore < avgCompScore) {
      topDifferentiatingIssue = myData.topIssue;
    }
  }

  return NextResponse.json({ brands: brandData, topDifferentiatingIssue });
}
