// Protected backfill endpoint — runs full computation pipeline for last 30 days
// Protect with BACKFILL_TOKEN env var

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { backfillTrustSignals, computeDailyBrandHealth } from "@/lib/health/trustIndex";
import { detectIncidents } from "@/lib/incidents/detectIncidents";
import { computeRootCause } from "@/lib/incidents/rootCause";
import { computeBlastRadius } from "@/lib/incidents/blastRadius";
import { computeNarrativeRisk } from "@/lib/incidents/narrativeRisk";
import { computeSimulations } from "@/lib/incidents/simulator";
import { detectCompetitorIncidents, computeOpportunities } from "@/lib/competitors/watch";

const BRAND_ID = "MosaicWellness";

export async function POST(req: NextRequest) {
  // Token check
  const token = req.headers.get("x-backfill-token") || new URL(req.url).searchParams.get("token");
  const expected = process.env.BACKFILL_TOKEN;
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const t0 = Date.now();

  try {
    // 1. Backfill trust signals on all existing Mention rows
    log.push("1. Backfilling trust signals on Mention rows...");
    const updated = await backfillTrustSignals(BRAND_ID);
    log.push(`   Updated ${updated} mention rows with trust signals.`);

    // 2. Detect incidents (last 30 days, checked in 48h windows)
    log.push("2. Detecting incidents...");
    const incidents = await detectIncidents({ brandId: BRAND_ID, windowHours: 48, baselineDays: 7 });
    log.push(`   Detected/found ${incidents.length} incidents (${incidents.filter(i => i.created).length} new).`);

    // 3. Compute daily brand health for last 30 days
    log.push("3. Computing daily brand health...");
    const latest = await prisma.mention.findFirst({
      where: { source: BRAND_ID },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    });
    if (latest) {
      const dataEnd = new Date(latest.timestamp);
      for (let d = 0; d < 30; d++) {
        const date = new Date(dataEnd.getTime() - d * 86_400_000);
        const dateStr = date.toISOString().slice(0, 10);
        await computeDailyBrandHealth(BRAND_ID, dateStr);
      }
      log.push(`   Computed health for last 30 days.`);
    }

    // 4. For each incident: root cause → blast radius → narrative risk → simulator
    log.push("4. Computing per-incident intelligence...");
    const impactScores: Array<{ id: string; title: string; impactScore: number }> = [];

    for (const incident of incidents) {
      try {
        await computeRootCause(incident.id);
        const br = await computeBlastRadius(incident.id);
        await computeNarrativeRisk(incident.id);
        await computeSimulations(incident.id);
        impactScores.push({ id: incident.id, title: incident.title, impactScore: br.impactScore });
      } catch (err) {
        log.push(`   WARN: Failed for incident ${incident.id}: ${(err as Error).message}`);
      }
    }

    // Top 3 incidents by impact score
    impactScores.sort((a, b) => b.impactScore - a.impactScore);
    log.push(`   Top 3 incidents by impact score:`);
    for (const inc of impactScores.slice(0, 3)) {
      log.push(`     - [${inc.impactScore}/100] ${inc.title}`);
    }

    // 5. Competitor watch
    log.push("5. Running competitor watch...");
    const competitorIncidents = await detectCompetitorIncidents(7);
    log.push(`   Found ${competitorIncidents.length} competitor incidents.`);
    const opportunities = await computeOpportunities(competitorIncidents);
    log.push(`   Identified ${opportunities.length} opportunities.`);

    const duration = Date.now() - t0;
    log.push(`\nBackfill completed in ${duration}ms.`);

    return NextResponse.json({
      ok: true,
      durationMs: duration,
      incidents: incidents.length,
      newIncidents: incidents.filter(i => i.created).length,
      topIncidents: impactScores.slice(0, 3),
      competitorIncidents: competitorIncidents.length,
      opportunities: opportunities.length,
      log,
    });
  } catch (err) {
    log.push(`ERROR: ${(err as Error).message}`);
    return NextResponse.json({ ok: false, log, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Quick status check: counts of key entities
  const [incidents, dailyHealth, competitorIncidents, opportunities] = await Promise.all([
    prisma.incident.count(),
    prisma.dailyBrandHealth.count(),
    prisma.competitorIncident.count(),
    prisma.competitorOpportunity.count(),
  ]);

  return NextResponse.json({ incidents, dailyHealth, competitorIncidents, opportunities });
}
