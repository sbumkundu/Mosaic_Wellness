// GET /api/incidents/[id] — full incident detail
// PATCH /api/incidents/[id] — update status

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeAttribution } from "@/lib/incidents/rootCause";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      clusters: { orderBy: { size: "desc" } },
      blastRadius: true,
      narrativeRisk: true,
      simulations: { orderBy: { actionType: "asc" } },
      suggestedResponses: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Attribution breakdown
  const attribution = await computeAttribution(params.id);

  // Timeline from hourly aggregates
  const timeline = await prisma.hourlyAggregate.findMany({
    where: {
      source: incident.brandId,
      hour: {
        gte: incident.windowStart.toISOString(),
        lte: incident.windowEnd.toISOString(),
      },
    },
    orderBy: { hour: "asc" },
    take: 100,
  });

  // Trust trend around incident
  const healthRows = await prisma.dailyBrandHealth.findMany({
    where: { brandId: incident.brandId },
    orderBy: { date: "desc" },
    take: 14,
  });

  // Competitor opportunities related to top issue
  const opportunities = await prisma.competitorOpportunity.findMany({
    where: { brandId: incident.brandId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const competitorIncidents = await prisma.competitorIncident.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    incident: {
      ...incident,
      clusters: incident.clusters.map(c => ({
        ...c,
        topTerms: JSON.parse(c.topTermsJson),
        topEntities: JSON.parse(c.topEntitiesJson),
        examples: JSON.parse(c.examplesJson),
      })),
      blastRadius: incident.blastRadius
        ? {
            ...incident.blastRadius,
            propagationPath: JSON.parse(incident.blastRadius.propagationPathJson),
            reasonCodes: JSON.parse(incident.blastRadius.reasonCodesJson),
          }
        : null,
      narrativeRisk: incident.narrativeRisk
        ? {
            ...incident.narrativeRisk,
            topTriggers: JSON.parse(incident.narrativeRisk.topTriggersJson),
            examples: JSON.parse(incident.narrativeRisk.examplesJson),
          }
        : null,
      simulations: incident.simulations.map(s => ({
        ...s,
        series: JSON.parse(s.seriesJson),
        matchedIncidents: JSON.parse(s.matchedIncidentsJson),
      })),
      suggestedResponses: incident.suggestedResponses.map(r => ({
        ...r,
        checklist: JSON.parse(r.checklistJson),
        redFlags: JSON.parse(r.redFlagsJson),
      })),
    },
    attribution,
    timeline,
    healthTrend: healthRows.reverse(),
    opportunities: opportunities.map(o => ({
      ...o,
      evidence: JSON.parse(o.evidenceJson),
    })),
    competitorIncidents: competitorIncidents.map(ci => ({
      ...ci,
      topIssues: JSON.parse(ci.topIssuesJson),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => ({}));
  const { status } = body;

  if (status && !["active", "investigating", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.incident.update({
    where: { id: params.id },
    data: { ...(status ? { status } : {}) },
  });

  return NextResponse.json({ ok: true, incident: updated });
}
