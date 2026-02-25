import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "MosaicWellness";
  const days = parseInt(searchParams.get("days") || "730");

  const latestMention = await prisma.mention.findFirst({ where: { source }, orderBy: { timestamp: "desc" }, select: { timestamp: true } });
  const dataEnd = latestMention ? new Date(latestMention.timestamp).getTime() : Date.now();
  const since = new Date(dataEnd - days * 24 * 60 * 60 * 1000);

  const mentions = await prisma.mention.findMany({
    where: { source, timestamp: { gte: since }, topIssue: { not: null } },
    select: { product: true, topIssue: true, sentimentLabel: true, credibilityScore: true },
  });

  // Build product x issue matrix
  const matrix = new Map<string, Map<string, { count: number; negCount: number; score: number }>>();

  for (const m of mentions) {
    const product = m.product || "General";
    const issue = m.topIssue!;

    if (!matrix.has(product)) matrix.set(product, new Map());
    const issueMap = matrix.get(product)!;

    if (!issueMap.has(issue)) issueMap.set(issue, { count: 0, negCount: 0, score: 0 });
    const cell = issueMap.get(issue)!;
    cell.count++;
    if (m.sentimentLabel === "neg") cell.negCount++;
    cell.score += m.credibilityScore;
  }

  const products = Array.from(matrix.keys()).slice(0, 10);
  const allIssues = ["product_quality", "delivery", "packaging", "pricing", "support", "side_effects", "billing", "trust_authenticity"];

  const heatmap = products.map(product => {
    const issueMap = matrix.get(product)!;
    return {
      product,
      issues: allIssues.map(issue => {
        const cell = issueMap.get(issue);
        if (!cell) return { issue, count: 0, negCount: 0, intensity: 0 };
        const intensity = Math.min(1, cell.negCount / Math.max(cell.count, 1));
        return { issue, count: cell.count, negCount: cell.negCount, intensity };
      }),
    };
  });

  return NextResponse.json({ heatmap, products, issues: allIssues });
}
