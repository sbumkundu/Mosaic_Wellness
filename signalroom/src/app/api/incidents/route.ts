// GET /api/incidents — list incidents with filters
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId") || "MosaicWellness";
  const status = searchParams.get("status");        // active|resolved|dismissed
  const severity = searchParams.get("severity");    // low|medium|high|critical
  const channel = searchParams.get("channel");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = { brandId };
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (channel) where.primaryChannel = channel;

  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        blastRadius: { select: { impactScore: true, etaToCrossChannelHours: true } },
        narrativeRisk: { select: { riskScore: true, riskLevel: true } },
        clusters: { select: { size: true, deltaVsBaseline: true }, orderBy: { size: "desc" }, take: 1 },
      },
    }),
  ]);

  // Enrich with daily health delta for trust index
  const enriched = await Promise.all(
    incidents.map(async inc => {
      // Get trust index at window end vs baseline
      const health = await prisma.dailyBrandHealth.findFirst({
        where: { brandId, date: inc.windowEnd.toISOString().slice(0, 10) },
        select: { trustIndex: true },
      });
      const baseHealth = await prisma.dailyBrandHealth.findFirst({
        where: { brandId, date: inc.baselineEnd.toISOString().slice(0, 10) },
        select: { trustIndex: true },
      });
      const trustDelta =
        health && baseHealth ? Math.round(health.trustIndex - baseHealth.trustIndex) : null;

      return {
        id: inc.id,
        title: inc.title,
        status: inc.status,
        severity: inc.severity,
        primaryChannel: inc.primaryChannel,
        productId: inc.productId,
        windowStart: inc.windowStart,
        windowEnd: inc.windowEnd,
        createdAt: inc.createdAt,
        summary: inc.summary,
        impactScore: inc.blastRadius?.impactScore ?? null,
        etaToCrossChannelHours: inc.blastRadius?.etaToCrossChannelHours ?? null,
        narrativeRiskScore: inc.narrativeRisk?.riskScore ?? null,
        narrativeRiskLevel: inc.narrativeRisk?.riskLevel ?? null,
        topClusterSize: inc.clusters[0]?.size ?? null,
        topClusterDelta: inc.clusters[0]?.deltaVsBaseline ?? null,
        trustIndexDelta: trustDelta,
      };
    })
  );

  return NextResponse.json({ incidents: enriched, total, limit, offset });
}
