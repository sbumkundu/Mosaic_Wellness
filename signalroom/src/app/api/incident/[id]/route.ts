import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clusterMentions } from "@/lib/clustering";
import { getPlaybook } from "@/lib/playbooks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const alert = await prisma.crisisAlert.findUnique({ where: { id: params.id } });
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // Get related mentions
  const since = new Date(alert.since);
  const where: any = { timestamp: { gte: since } };
  if (alert.channel) where.channel = alert.channel;
  if (alert.issue) where.topIssue = alert.issue;
  if (alert.product) where.product = { contains: alert.product };

  const mentions = await prisma.mention.findMany({
    where,
    orderBy: { timestamp: "asc" },
    take: 100,
  });

  // Cluster mentions into narratives
  const clusters = clusterMentions(
    mentions.map(m => ({
      id: m.id,
      text: m.text,
      topIssue: m.topIssue,
      timestamp: new Date(m.timestamp),
      product: m.product,
    })),
    2,
    0.2
  );

  // Timeline: hourly bucketed counts
  const hourlyMap = new Map<string, { hour: string; count: number; negCount: number; avgSentiment: number }>();
  for (const m of mentions) {
    const h = new Date(m.timestamp);
    h.setMinutes(0, 0, 0);
    const k = h.toISOString();
    if (!hourlyMap.has(k)) hourlyMap.set(k, { hour: k, count: 0, negCount: 0, avgSentiment: 0 });
    const cell = hourlyMap.get(k)!;
    const prev = cell.avgSentiment * cell.count;
    cell.count++;
    if (m.sentimentLabel === "neg") cell.negCount++;
    cell.avgSentiment = (prev + m.sentimentScore) / cell.count;
  }
  const timeline = Array.from(hourlyMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

  // Location breakdown
  const locationCounts = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  for (const m of mentions) {
    if (m.location) locationCounts.set(m.location, (locationCounts.get(m.location) || 0) + 1);
    if (m.deliveryPartner) partnerCounts.set(m.deliveryPartner, (partnerCounts.get(m.deliveryPartner) || 0) + 1);
  }

  const playbook = alert.issue ? getPlaybook(alert.issue) : null;

  return NextResponse.json({
    alert,
    mentions: mentions.map(m => ({ ...m, issueLabels: JSON.parse(m.issueLabels || "[]"), entities: JSON.parse(m.entities || "{}") })),
    clusters,
    timeline,
    locations: Array.from(locationCounts.entries()).map(([name, count]) => ({ name, count })),
    deliveryPartners: Array.from(partnerCounts.entries()).map(([name, count]) => ({ name, count })),
    playbook,
    totalMentions: mentions.length,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = await prisma.crisisAlert.update({
    where: { id: params.id },
    data: {
      status: body.status || undefined,
      playbook: body.playbook ? JSON.stringify(body.playbook) : undefined,
    },
  });
  return NextResponse.json(updated);
}
