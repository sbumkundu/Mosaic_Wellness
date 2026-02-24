import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId") || "MosaicWellness";
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);

  const rows = await prisma.dailyBrandHealth.findMany({
    where: { brandId },
    orderBy: { date: "asc" },
    take: days,
  });

  return NextResponse.json({
    rows: rows.map(r => ({
      date: r.date,
      trustIndex: r.trustIndex,
      narrativeRiskIndex: r.narrativeRiskIndex,
      sentimentIndex: r.sentimentIndex,
      volume: r.volume,
      trustBreakdown: (() => { try { return JSON.parse(r.trustBreakdownJson); } catch { return {}; } })(),
    })),
    total: rows.length,
  });
}
