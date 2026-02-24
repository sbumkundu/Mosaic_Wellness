// Blast Radius Engine — computes Impact Score 0-100 + propagation prediction

import { prisma } from "@/lib/db";

// Channel risk weights — higher = faster / wider propagation
const CHANNEL_RISK: Record<string, number> = {
  twitter: 0.95,
  reddit: 0.90,
  instagram: 0.75,
  complaints: 0.70,
  google: 0.55,
  amazon: 0.50,
  nykaa: 0.45,
};

const CHANNEL_ETA_HOURS: Record<string, number> = {
  twitter: 2,
  reddit: 4,
  instagram: 6,
  complaints: 12,
  google: 24,
  amazon: 36,
  nykaa: 40,
};

// Engagement velocity: mentions per hour in the window
function computeVelocity(count: number, windowHours: number): number {
  return windowHours > 0 ? count / windowHours : count;
}

export interface BlastRadiusResult {
  impactScore: number;
  etaToCrossChannelHours: number | null;
  expectedReach24h: number | null;
  expectedReach48h: number | null;
  propagationPath: string[];
  reasonCodes: string[];
}

export async function computeBlastRadius(incidentId: string): Promise<BlastRadiusResult> {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) {
    return { impactScore: 0, etaToCrossChannelHours: null, expectedReach24h: null, expectedReach48h: null, propagationPath: [], reasonCodes: [] };
  }

  const windowHours =
    (incident.windowEnd.getTime() - incident.windowStart.getTime()) / 3_600_000;

  // Fetch window mentions
  const mentions = await prisma.mention.findMany({
    where: {
      source: incident.brandId,
      timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
    },
    select: {
      channel: true, sentimentScore: true, engagement: true,
      credibilityScore: true, blastRadius: true, topIssue: true,
      timestamp: true,
    },
    take: 500,
  });

  if (mentions.length === 0) {
    return { impactScore: 0, etaToCrossChannelHours: null, expectedReach24h: null, expectedReach48h: null, propagationPath: [], reasonCodes: [] };
  }

  const reasonCodes: string[] = [];

  // 1. Sentiment severity score (0-25)
  type MRow = (typeof mentions)[number];
  const avgSentiment = mentions.reduce((s: number, m: MRow) => s + m.sentimentScore, 0) / mentions.length;
  const sentimentScore = Math.min(25, Math.max(0, (-avgSentiment + 1) / 2 * 25));
  if (avgSentiment < -0.5) reasonCodes.push("Highly negative average sentiment");

  // 2. Engagement velocity (0-25)
  const totalEngagement = mentions.reduce((s: number, m: MRow) => s + m.engagement, 0);
  const velocity = computeVelocity(mentions.length, windowHours);
  const engagementScore = Math.min(25, (Math.log1p(totalEngagement) / Math.log1p(5000)) * 15 + (Math.log1p(velocity) / Math.log1p(10)) * 10);
  if (velocity > 2) reasonCodes.push(`High mention velocity (${velocity.toFixed(1)}/hr)`);
  if (totalEngagement > 500) reasonCodes.push(`High engagement (${totalEngagement} total)`);

  // 3. Channel risk (0-25)
  const channels = Array.from(new Set(mentions.map(m => m.channel)));
  const maxChannelRisk = channels.length > 0
    ? Math.max(...channels.map(ch => CHANNEL_RISK[ch] || 0.5))
    : 0;
  const channelScore = maxChannelRisk * 25;
  if (channels.includes("twitter") || channels.includes("reddit")) {
    reasonCodes.push(`High-propagation channel: ${channels.filter(c => ["twitter","reddit"].includes(c)).join(", ")}`);
  }

  // 4. Novelty — cluster delta vs baseline (0-15)
  const clusters = await prisma.incidentCluster.findMany({ where: { incidentId } });
  const maxDelta = clusters.length > 0 ? Math.max(...clusters.map(c => c.deltaVsBaseline)) : 1;
  const noveltyScore = maxDelta > 1
    ? Math.min(15, (Math.log1p(maxDelta - 1) / Math.log1p(9)) * 15)
    : 0;
  if (maxDelta > 3) reasonCodes.push(`New cluster: ${maxDelta.toFixed(1)}× above baseline`);

  // 5. Cross-channel spread (0-10)
  const crossChannelScore = Math.min(10, (channels.length / 7) * 10);
  if (channels.length >= 3) reasonCodes.push(`Spreading across ${channels.length} channels`);

  // Total impact score
  const impactScore = Math.min(100, Math.round(sentimentScore + engagementScore + channelScore + noveltyScore + crossChannelScore));

  // ETA to cross-channel spread: use the fastest channel present
  const minEta = Math.min(...channels.map(ch => CHANNEL_ETA_HOURS[ch] || 24));
  const etaToCrossChannelHours = channels.length >= 2 ? null : minEta; // already spread if multi-channel

  // Expected reach: proxy from velocity × channel multiplier
  const channelMultiplier = channels.reduce((sum: number, ch: string) => sum + (CHANNEL_RISK[ch] || 0.5), 0) / channels.length;
  const baseReach = totalEngagement + mentions.length * 10;
  const expectedReach24h = Math.round(baseReach * channelMultiplier * 1.5);
  const expectedReach48h = Math.round(baseReach * channelMultiplier * 3.2);

  // Propagation path: sort channels by risk weight
  const propagationPath = [...channels].sort((a, b) => (CHANNEL_RISK[b] || 0) - (CHANNEL_RISK[a] || 0));

  // Persist
  await prisma.incidentBlastRadius.upsert({
    where: { incidentId },
    update: {
      impactScore,
      etaToCrossChannelHours,
      expectedReach24h,
      expectedReach48h,
      propagationPathJson: JSON.stringify(propagationPath),
      reasonCodesJson: JSON.stringify(reasonCodes),
    },
    create: {
      incidentId,
      impactScore,
      etaToCrossChannelHours,
      expectedReach24h,
      expectedReach48h,
      propagationPathJson: JSON.stringify(propagationPath),
      reasonCodesJson: JSON.stringify(reasonCodes),
    },
  });

  return { impactScore, etaToCrossChannelHours, expectedReach24h, expectedReach48h, propagationPath, reasonCodes };
}
