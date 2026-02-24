// Competitor Watch — detect competitor incidents and surface opportunities

import { prisma } from "@/lib/db";
import brandStrengths from "../../../config/brandStrengths.json";
import { scoreText } from "@/lib/incidents/narrativeRisk";

const BRAND_ID = "MosaicWellness";

// ── Competitor incident detection ────────────────────────────────────────────

export interface CompetitorIncidentSummary {
  id: string;
  competitorId: string;
  competitorName: string;
  windowStart: Date;
  windowEnd: Date;
  summary: string;
  topIssues: Array<{ issue: string; count: number }>;
  riskScore: number;
}

export async function detectCompetitorIncidents(
  windowDays = 7,
): Promise<CompetitorIncidentSummary[]> {
  // Get all competitor names from DB
  const competitors = await prisma.competitor.findMany();
  if (competitors.length === 0) return [];

  const results: CompetitorIncidentSummary[] = [];

  // Anchor to latest mention timestamp
  const latest = await prisma.mention.findFirst({
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  if (!latest) return [];

  const dataEnd = new Date(latest.timestamp);
  const windowStart = new Date(dataEnd.getTime() - windowDays * 24 * 3_600_000);

  for (const competitor of competitors) {
    const mentions = await prisma.mention.findMany({
      where: {
        source: competitor.name,
        timestamp: { gte: windowStart, lte: dataEnd },
        sentimentLabel: "neg",
      },
      select: { text: true, topIssue: true, sentimentScore: true, engagement: true },
      take: 200,
    });

    if (mentions.length < 3) continue; // not enough signal

    // Count by issue
    const issueCounts = new Map<string, number>();
    for (const m of mentions) {
      const issue = m.topIssue || "unknown";
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    }
    const topIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    // Risk score using narrative patterns
    let narrativeSum = 0;
    for (const m of mentions) {
      const { score } = scoreText(m.text);
      const weight = 1 + Math.log1p(m.engagement) / Math.log1p(500);
      narrativeSum += score * weight;
    }
    const riskScore = Math.min(100, Math.round((narrativeSum / (mentions.length * 10)) * 100));

    const topIssueName = topIssues[0]?.issue.replace(/_/g, " ") || "various issues";
    const summary = `${competitor.name} received ${mentions.length} negative mentions about "${topIssueName}" in the last ${windowDays} days.`;

    // Persist / upsert
    const saved = await prisma.competitorIncident.create({
      data: {
        competitorId: competitor.id,
        windowStart,
        windowEnd: dataEnd,
        summary,
        topIssuesJson: JSON.stringify(topIssues),
        riskScore,
      },
    });

    results.push({
      id: saved.id,
      competitorId: competitor.id,
      competitorName: competitor.name,
      windowStart,
      windowEnd: dataEnd,
      summary,
      topIssues,
      riskScore,
    });
  }

  return results;
}

// ── Opportunity mapping ───────────────────────────────────────────────────────

export interface OpportunitySummary {
  id: string;
  brandId: string;
  competitorId: string;
  competitorName: string;
  summary: string;
  recommendedAction: string;
  evidence: string[];
}

const ISSUE_TO_STRENGTH: Record<string, string[]> = {
  delivery: ["fast_delivery"],
  packaging: ["leak_proof_packaging"],
  side_effects: ["derm_tested", "clean_ingredients"],
  trust_authenticity: ["authenticity_qr"],
  support: ["responsive_support"],
  product_quality: ["derm_tested", "clean_ingredients"],
};

export async function computeOpportunities(
  competitorIncidents: CompetitorIncidentSummary[],
): Promise<OpportunitySummary[]> {
  const ourStrengths =
    (brandStrengths as Record<string, { strengths: Array<{ id: string; label: string; keywords: string[] }> }>)[BRAND_ID]?.strengths || [];
  const results: OpportunitySummary[] = [];

  for (const incident of competitorIncidents) {
    for (const { issue } of incident.topIssues) {
      const strengthIds = ISSUE_TO_STRENGTH[issue] || [];
      const relevantStrengths = ourStrengths.filter(s => strengthIds.includes(s.id));
      if (relevantStrengths.length === 0) continue;

      // Pull evidence: competitor negative mentions about this issue
      const evidenceMentions = await prisma.mention.findMany({
        where: {
          source: incident.competitorName,
          topIssue: issue,
          sentimentLabel: "neg",
          timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
        },
        select: { text: true },
        take: 3,
      });

      const evidence = evidenceMentions.map(m =>
        m.text
          .replace(/\b\d{10}\b/g, "[PHONE]")
          .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]")
          .slice(0, 150)
      );

      const strengthLabel = relevantStrengths[0].label;
      const summary = `${incident.competitorName} is being criticised for "${issue.replace(/_/g, " ")}" — our "${strengthLabel}" is a direct differentiator.`;
      const recommendedAction = `Run a targeted campaign or content piece highlighting our ${strengthLabel} to capture dissatisfied ${incident.competitorName} customers.`;

      const saved = await prisma.competitorOpportunity.create({
        data: {
          brandId: BRAND_ID,
          competitorId: incident.competitorId,
          summary,
          recommendedAction,
          evidenceJson: JSON.stringify(evidence),
        },
      });

      results.push({
        id: saved.id,
        brandId: BRAND_ID,
        competitorId: incident.competitorId,
        competitorName: incident.competitorName,
        summary,
        recommendedAction,
        evidence,
      });
    }
  }

  return results;
}
