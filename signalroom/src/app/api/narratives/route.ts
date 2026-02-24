import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clusterMentions } from "@/lib/clustering";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "MosaicWellness";
  const days = parseInt(searchParams.get("days") || "7");
  const latestMention = await prisma.mention.findFirst({ where: { source }, orderBy: { timestamp: "desc" }, select: { timestamp: true } });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const since = new Date(dataEnd - days * 24 * 3600000);

  const mentions = await prisma.mention.findMany({
    where: { source, timestamp: { gte: since }, sentimentLabel: "neg" },
    select: { id: true, text: true, topIssue: true, timestamp: true, product: true },
    take: 200,
  });

  const clusters = clusterMentions(
    mentions.map(m => ({ id: m.id, text: m.text, topIssue: m.topIssue, timestamp: new Date(m.timestamp), product: m.product })),
    2,
    0.2
  );

  return NextResponse.json({ clusters, total: clusters.length });
}
