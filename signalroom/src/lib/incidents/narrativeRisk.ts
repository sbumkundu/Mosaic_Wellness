// Narrative Hijack Detector — detects escalation beyond sentiment
// Uses lexicon + regex patterns to detect moral framing, fraud accusations, CTAs

import { prisma } from "@/lib/db";

interface TriggerGroup {
  name: string;
  weight: number;
  patterns: RegExp[];
}

const TRIGGER_GROUPS: TriggerGroup[] = [
  {
    name: "fraud_scam",
    weight: 3.0,
    patterns: [
      /\b(scam|fraud|fraudulent|cheat|cheating|cheated|swindl)\b/i,
      /\b(fake|counterfeit|duplicate|spurious|adulterated)\b/i,
    ],
  },
  {
    name: "safety_alarm",
    weight: 2.8,
    patterns: [
      /\b(unsafe|dangerous|hazardous|toxic|poisonous)\b/i,
      /\b(lawsuit|legal action|fir|complaint filed|police|court|sue|suing|sued)\b/i,
      /\b(recall|ban|banned|regulator|cdsco|fda|authority)\b/i,
    ],
  },
  {
    name: "boycott_cta",
    weight: 2.5,
    patterns: [
      /\b(boycott|never buy|avoid|stay away|blacklist|warn everyone)\b/i,
      /\b(don't buy|do not buy|stop buying|stop ordering)\b/i,
      /\b(share this|tag everyone|spread the word|retweet|rt this)\b/i,
    ],
  },
  {
    name: "moral_framing",
    weight: 2.0,
    patterns: [
      /\b(they don.?t care|don.?t care about|care about money|care about profit)\b/i,
      /\b(hiding|covering up|coverup|not telling|lying|lied|misleading|deceiving)\b/i,
      /\b(corrupt|greed|greedy|shameless|disgrace|disgusting|pathetic)\b/i,
    ],
  },
  {
    name: "media_escalation",
    weight: 2.2,
    patterns: [
      /\b(news|media|journalist|reporter|press|nbc|times|hindustan|ndtv)\b/i,
      /\b(viral|trending|going viral|blown up|everywhere)\b/i,
      /\b(consumer forum|consumer court|national commission)\b/i,
    ],
  },
  {
    name: "institutional_trust_attack",
    weight: 1.8,
    patterns: [
      /\b(fake reviews|paid reviews|manipulated|astroturfing|bought reviews)\b/i,
      /\b(not genuine|not real|sponsored|shill|pr stunt)\b/i,
    ],
  },
];

function scoreText(text: string): { score: number; triggers: string[] } {
  const lower = text.toLowerCase();
  let score = 0;
  const triggers: string[] = [];

  for (const group of TRIGGER_GROUPS) {
    for (const pattern of group.patterns) {
      if (pattern.test(lower)) {
        score += group.weight;
        if (!triggers.includes(group.name)) triggers.push(group.name);
        break; // one match per group enough
      }
    }
  }

  return { score, triggers };
}

function redactText(text: string): string {
  return text
    .replace(/\b[A-Z]{2,4}[\d]{6,12}\b/g, "[ORDER_ID]")
    .replace(/\b\d{10}\b/g, "[PHONE]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]")
    .slice(0, 200);
}

export interface NarrativeRiskResult {
  riskScore: number;
  riskLevel: "LOW" | "MED" | "HIGH";
  topTriggers: Array<{ name: string; count: number }>;
  examples: string[];
}

export async function computeNarrativeRisk(incidentId: string): Promise<NarrativeRiskResult> {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) {
    return { riskScore: 0, riskLevel: "LOW", topTriggers: [], examples: [] };
  }

  const mentions = await prisma.mention.findMany({
    where: {
      source: incident.brandId,
      timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
      sentimentLabel: "neg",
    },
    select: { text: true, engagement: true },
    take: 300,
  });

  if (mentions.length === 0) {
    return { riskScore: 0, riskLevel: "LOW", topTriggers: [], examples: [] };
  }

  let totalScore = 0;
  const triggerCounts = new Map<string, number>();
  const flaggedMentions: Array<{ score: number; text: string }> = [];

  for (const m of mentions) {
    const { score, triggers } = scoreText(m.text);
    // Engagement amplification: high-engagement posts matter more
    const weight = 1 + Math.log1p(m.engagement) / Math.log1p(1000);
    totalScore += score * weight;

    for (const t of triggers) triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1);
    if (score > 0) flaggedMentions.push({ score, text: m.text });
  }

  // Normalize: max possible score per mention ≈ 12 (all groups triggered × weight 2)
  const maxPossible = mentions.length * 12;
  const rawRisk = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
  const riskScore = Math.min(100, Math.round(rawRisk));

  const riskLevel: "LOW" | "MED" | "HIGH" =
    riskScore >= 50 ? "HIGH" : riskScore >= 20 ? "MED" : "LOW";

  const topTriggers = Array.from(triggerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const examples = flaggedMentions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(m => redactText(m.text));

  // Persist
  await prisma.incidentNarrativeRisk.upsert({
    where: { incidentId },
    update: {
      riskScore,
      riskLevel,
      topTriggersJson: JSON.stringify(topTriggers),
      examplesJson: JSON.stringify(examples),
    },
    create: {
      incidentId,
      riskScore,
      riskLevel,
      topTriggersJson: JSON.stringify(topTriggers),
      examplesJson: JSON.stringify(examples),
    },
  });

  return { riskScore, riskLevel, topTriggers, examples };
}

// Export pattern matcher for testing
export { scoreText };
