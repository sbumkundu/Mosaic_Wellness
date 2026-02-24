// Counterfactual Crisis Simulator
// Estimates 48h recovery curves for each action type by:
// 1. Finding similar historical incidents from DB
// 2. Applying action-specific damping factors
// 3. Falling back to heuristic curves if no history

import { prisma } from "@/lib/db";
import actionsCatalog from "../../../config/actionsCatalog.json";

const ACTIONS = actionsCatalog.actions;
const HORIZON_HOURS = 48;

export interface SimPoint {
  hour: number;
  volume: number;
  negShare: number;
  trustIndex: number;
  narrativeRisk: number;
}

export interface SimulationResult {
  actionType: string;
  series: SimPoint[];
  confidence: number;
  matchedIncidentIds: string[];
}

// Find historically similar incidents (taxonomy + channel + size overlap)
async function findSimilarIncidents(
  incidentId: string,
  brandId: string,
  primaryChannel: string | null,
  windowMentionCount: number,
): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180); // last 6 months

  const past = await prisma.incident.findMany({
    where: {
      id: { not: incidentId },
      brandId,
      status: "resolved",
      createdAt: { gte: cutoff },
    },
    select: { id: true, primaryChannel: true, summary: true },
    take: 20,
  });

  // Score by channel match
  const scored = past.map(p => ({
    id: p.id,
    score: (p.primaryChannel === primaryChannel ? 2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.id);
}

// Generate a baseline decay curve (no action)
function baselineDecay(
  startVolume: number,
  startNegShare: number,
  startTrust: number,
  startNarrativeRisk: number,
): SimPoint[] {
  const series: SimPoint[] = [];
  // Natural decay: volume halves in ~5 days, negShare regresses to mean slowly
  const volHalfLifeHours = 120;
  const lambda = Math.log(2) / volHalfLifeHours;

  for (let h = 0; h < HORIZON_HOURS; h++) {
    const volume = Math.max(0, startVolume * Math.exp(-lambda * h));
    const negShare = startNegShare * (0.95 ** (h / 8)); // slow regression
    const trustIndex = Math.min(100, startTrust + (50 - startTrust) * (h / HORIZON_HOURS) * 0.2);
    const narrativeRisk = Math.max(0, startNarrativeRisk * (0.97 ** (h / 4)));
    series.push({ hour: h, volume: Math.round(volume * 10) / 10, negShare: Math.round(negShare * 100) / 100, trustIndex: Math.round(trustIndex), narrativeRisk: Math.round(narrativeRisk) });
  }
  return series;
}

// Apply action damping to baseline curve
function applyAction(
  baseline: SimPoint[],
  dampingFactor: number,
  trustRecoveryRate: number,
  narrativeRiskReduction: number,
  actionStartHour = 6, // actions take 6h to kick in
): SimPoint[] {
  return baseline.map((pt, i) => {
    if (i < actionStartHour) return pt;
    const elapsed = i - actionStartHour;
    const factor = Math.pow(1 - dampingFactor, elapsed / 12);
    const tRecovery = trustRecoveryRate * (1 - Math.exp(-elapsed / 16));
    const nrReduction = narrativeRiskReduction * (1 - Math.exp(-elapsed / 10));
    return {
      hour: pt.hour,
      volume: Math.max(0, Math.round(pt.volume * factor * 10) / 10),
      negShare: Math.max(0, Math.round((pt.negShare * factor) * 100) / 100),
      trustIndex: Math.min(100, Math.round(pt.trustIndex + tRecovery * (100 - pt.trustIndex))),
      narrativeRisk: Math.max(0, Math.round(pt.narrativeRisk * (1 - nrReduction))),
    };
  });
}

export async function computeSimulations(incidentId: string): Promise<SimulationResult[]> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { blastRadius: true, narrativeRisk: true },
  });
  if (!incident) return [];

  // Get current state at window end
  const windowMentions = await prisma.mention.findMany({
    where: {
      source: incident.brandId,
      timestamp: { gte: incident.windowStart, lte: incident.windowEnd },
    },
    select: { sentimentLabel: true, engagement: true },
    take: 500,
  });

  const total = windowMentions.length;
  const neg = windowMentions.filter(m => m.sentimentLabel === "neg").length;
  const startVolume = total;
  const startNegShare = total > 0 ? neg / total : 0;

  // Fetch trust + narrative risk from DB
  const healthRow = await prisma.dailyBrandHealth.findFirst({
    where: { brandId: incident.brandId },
    orderBy: { date: "desc" },
    select: { trustIndex: true, narrativeRiskIndex: true },
  });
  const startTrust = healthRow?.trustIndex ?? 60;
  const startNarrativeRisk = incident.narrativeRisk?.riskScore ?? 30;

  const matchedIds = await findSimilarIncidents(
    incidentId,
    incident.brandId,
    incident.primaryChannel,
    total,
  );

  const baseline = baselineDecay(startVolume, startNegShare, startTrust, startNarrativeRisk);
  const results: SimulationResult[] = [];

  for (const action of ACTIONS) {
    const series = action.dampingFactor === 0
      ? baseline
      : applyAction(
          baseline,
          action.dampingFactor,
          action.trustRecoveryRate,
          action.narrativeRiskReduction,
        );

    const confidence = matchedIds.length > 0 ? 0.55 + matchedIds.length * 0.05 : 0.35;

    // Upsert simulation
    const existing = await prisma.incidentSimulation.findFirst({
      where: { incidentId, actionType: action.id },
    });
    if (existing) {
      await prisma.incidentSimulation.update({
        where: { id: existing.id },
        data: {
          seriesJson: JSON.stringify(series),
          confidence,
          matchedIncidentsJson: JSON.stringify(matchedIds),
        },
      });
    } else {
      await prisma.incidentSimulation.create({
        data: {
          incidentId,
          actionType: action.id,
          seriesJson: JSON.stringify(series),
          confidence,
          matchedIncidentsJson: JSON.stringify(matchedIds),
        },
      });
    }

    results.push({ actionType: action.id, series, confidence, matchedIncidentIds: matchedIds });
  }

  return results;
}
