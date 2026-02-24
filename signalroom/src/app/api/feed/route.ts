import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || undefined;
  const issue = searchParams.get("issue") || undefined;
  const sentiment = searchParams.get("sentiment") || undefined;
  const language = searchParams.get("language") || undefined;
  const product = searchParams.get("product") || undefined;
  const source = searchParams.get("source") || "MosaicWellness";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const offset = parseInt(searchParams.get("offset") || "0");
  const since = searchParams.get("since");

  const where: any = { source };
  if (channel) where.channel = channel;
  if (issue) where.topIssue = issue;
  if (sentiment) where.sentimentLabel = sentiment;
  if (language) where.language = { startsWith: language };
  if (product) where.product = { contains: product };
  if (since) where.timestamp = { gte: new Date(since) };

  const [mentions, total] = await Promise.all([
    prisma.mention.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.mention.count({ where }),
  ]);

  const parsed = mentions.map(m => ({
    ...m,
    issueLabels: JSON.parse(m.issueLabels || "[]"),
    entities: JSON.parse(m.entities || "{}"),
  }));

  return NextResponse.json({ mentions: parsed, total, limit, offset });
}
