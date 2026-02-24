import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hoursBack = parseInt(searchParams.get("hoursBack") || "48");
  const source = searchParams.get("source") || "MosaicWellness";

  const latestMention = await prisma.mention.findFirst({ where: { source }, orderBy: { timestamp: "desc" }, select: { timestamp: true } });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const since = new Date(dataEnd - hoursBack * 3600000);

  const mentions = await prisma.mention.findMany({
    where: { source, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    select: {
      id: true, channel: true, timestamp: true, text: true, sentimentLabel: true,
      topIssue: true, product: true, credibilityScore: true, engagement: true,
      blastRadius: true, isSimulated: true,
    },
    take: 500,
  });

  // Return mentions with relative delay (for replay at 5x speed)
  const minTime = mentions.length > 0 ? new Date(mentions[0].timestamp).getTime() : Date.now();
  const SPEED = 5;

  const replayEvents = mentions.map(m => ({
    ...m,
    replayDelayMs: Math.round((new Date(m.timestamp).getTime() - minTime) / (SPEED * 1000)) * 1000,
  }));

  return NextResponse.json({ events: replayEvents, totalEvents: mentions.length, hoursBack, speed: SPEED });
}
