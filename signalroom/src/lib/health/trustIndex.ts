// Trust Index — per mention signal extraction + daily aggregation
// Separate from sentiment: measures institutional trust erosion signals

import { prisma } from "@/lib/db";

// ── Signal patterns ──────────────────────────────────────────────────────────

const SIGNAL_PATTERNS = {
  refundMention: [
    /\b(refund|chargeback|money back|return|reimburse|cashback)\b/i,
    /\b(dispute|claim|escalate to bank|credit card dispute)\b/i,
  ],
  fakeClaim: [
    /\b(fake review|paid review|fake product|counterfeit|duplicate|spurious)\b/i,
    /\b(not genuine|looks fake|seems fake|smells fake|fake seal)\b/i,
  ],
  churnIntent: [
    /\bnever\b.{0,30}\b(ordering|buying|shopping|using|ordering again)\b/i,
    /\b(never again|not ordering again|not buying again)\b/i,
    /\b(last (time|order|purchase)|done with|done ordering|switching to)\b/i,
    /\b(uninstall|deleted app|cancelled subscription|cancelled my)\b/i,
  ],
  supportFailure: [
    /\b(no response|no reply|ignored|no help|unhelpful|useless support)\b/i,
    /\b(support (didn.?t|did not|won.?t|will not) help)\b/i,
    /\b(waiting for days|been waiting|still waiting|no one (replied|responded|called))\b/i,
  ],
  fraudClaim: [
    /\b(fraud|fraudulent|scam|scammed|cheated|swindled)\b/i,
    /\b(stole|theft|robbery|illegal|criminal|report to police)\b/i,
  ],
};

// Weights for trust index computation
const SIGNAL_WEIGHTS = {
  refundMention: 0.20,
  fakeClaim: 0.25,
  churnIntent: 0.20,
  supportFailure: 0.15,
  fraudClaim: 0.20,
};

export interface TrustSignals {
  refundMention: boolean;
  fakeClaim: boolean;
  churnIntent: boolean;
  supportFailure: boolean;
  fraudClaim: boolean;
}

/** Extract trust signals from a single piece of text. */
export function extractTrustSignals(text: string): TrustSignals {
  const result: TrustSignals = {
    refundMention: false,
    fakeClaim: false,
    churnIntent: false,
    supportFailure: false,
    fraudClaim: false,
  };

  for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS) as Array<[keyof TrustSignals, RegExp[]]>) {
    result[signal] = patterns.some(p => p.test(text));
  }

  return result;
}

/** Compute trust index 0–100 for a set of mentions (100 = fully trusted). */
function computeTrustIndex(
  total: number,
  counts: Record<keyof TrustSignals, number>,
): number {
  if (total === 0) return 100;

  let penaltySum = 0;
  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS) as Array<[keyof TrustSignals, number]>) {
    const rate = counts[signal] / total;
    penaltySum += rate * weight;
  }

  // penaltySum in [0, 1]. Map to index in [0, 100].
  // Full trust = 100. Max penalty brings it to ~0.
  return Math.max(0, Math.round((1 - Math.min(1, penaltySum * 3)) * 100));
}

// ── Backfill trust signals on existing Mention rows ──────────────────────────

export async function backfillTrustSignals(brandId: string): Promise<number> {
  const batch = 200;
  let cursor: string | undefined;
  let updated = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const mentions = await prisma.mention.findMany({
      where: { source: brandId },
      orderBy: { id: "asc" },
      take: batch,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, text: true },
    });
    if (mentions.length === 0) break;

    for (const m of mentions) {
      const signals = extractTrustSignals(m.text);
      await prisma.mention.update({
        where: { id: m.id },
        data: signals,
      });
      updated++;
    }

    cursor = mentions[mentions.length - 1].id;
    if (mentions.length < batch) break;
  }

  return updated;
}

// ── Daily brand health aggregation ──────────────────────────────────────────

export interface DailyHealthResult {
  date: string;
  sentimentIndex: number;
  volume: number;
  trustIndex: number;
  trustBreakdown: Record<string, number>;
  narrativeRiskIndex: number;
}

export async function computeDailyBrandHealth(
  brandId: string,
  date: string, // YYYY-MM-DD
): Promise<DailyHealthResult> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const mentions = await prisma.mention.findMany({
    where: {
      source: brandId,
      timestamp: { gte: dayStart, lte: dayEnd },
    },
    select: {
      sentimentScore: true,
      refundMention: true,
      fakeClaim: true,
      churnIntent: true,
      supportFailure: true,
      fraudClaim: true,
      text: true,
    },
  });

  const volume = mentions.length;
  const sentimentIndex =
    volume > 0 ? mentions.reduce((s, m) => s + m.sentimentScore, 0) / volume : 0;

  const counts: Record<keyof TrustSignals, number> = {
    refundMention: 0, fakeClaim: 0, churnIntent: 0, supportFailure: 0, fraudClaim: 0,
  };
  for (const m of mentions) {
    if (m.refundMention) counts.refundMention++;
    if (m.fakeClaim) counts.fakeClaim++;
    if (m.churnIntent) counts.churnIntent++;
    if (m.supportFailure) counts.supportFailure++;
    if (m.fraudClaim) counts.fraudClaim++;
  }

  const trustIndex = computeTrustIndex(volume, counts);

  // Narrative risk: use stored incident narrative risk avg if available
  const narrativeRisks = await prisma.incidentNarrativeRisk.findMany({
    where: {
      incident: {
        brandId,
        windowStart: { gte: dayStart },
        windowEnd: { lte: dayEnd },
      },
    },
    select: { riskScore: true },
  });
  const narrativeRiskIndex =
    narrativeRisks.length > 0
      ? narrativeRisks.reduce((s: number, r: { riskScore: number }) => s + r.riskScore, 0) / narrativeRisks.length
      : 0;

  const trustBreakdown = { ...counts };

  // Persist / upsert
  await prisma.dailyBrandHealth.upsert({
    where: { brandId_date: { brandId, date } },
    update: { sentimentIndex, volume, trustIndex, trustBreakdownJson: JSON.stringify(trustBreakdown), narrativeRiskIndex },
    create: { brandId, date, sentimentIndex, volume, trustIndex, trustBreakdownJson: JSON.stringify(trustBreakdown), narrativeRiskIndex },
  });

  return { date, sentimentIndex, volume, trustIndex, trustBreakdown, narrativeRiskIndex };
}

export { SIGNAL_PATTERNS };
