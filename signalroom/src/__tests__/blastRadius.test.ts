import { describe, it, expect } from "vitest";

// Unit-test the scoring math used in blastRadius.ts without DB

const CHANNEL_RISK: Record<string, number> = {
  twitter: 0.95, reddit: 0.90, instagram: 0.75,
  complaints: 0.70, google: 0.55, amazon: 0.50, nykaa: 0.45,
};

function computeImpactScore(
  avgSentiment: number,
  totalEngagement: number,
  mentionCount: number,
  windowHours: number,
  channels: string[],
  maxDelta: number,
): number {
  const velocity = windowHours > 0 ? mentionCount / windowHours : mentionCount;
  const sentimentScore = Math.min(25, Math.max(0, (-avgSentiment + 1) / 2 * 25));
  const engagementScore = Math.min(
    25,
    (Math.log1p(totalEngagement) / Math.log1p(5000)) * 15 +
    (Math.log1p(velocity) / Math.log1p(10)) * 10
  );
  const maxChannelRisk = channels.length > 0
    ? Math.max(...channels.map(ch => CHANNEL_RISK[ch] || 0.5))
    : 0;
  const channelScore = maxChannelRisk * 25;
  const noveltyScore = maxDelta > 1
    ? Math.min(15, (Math.log1p(maxDelta - 1) / Math.log1p(9)) * 15)
    : 0;
  const crossChannelScore = Math.min(10, (channels.length / 7) * 10);
  return Math.min(100, Math.round(sentimentScore + engagementScore + channelScore + noveltyScore + crossChannelScore));
}

describe("Blast radius score is deterministic", () => {
  it("produces same result for identical inputs", () => {
    const a = computeImpactScore(-0.7, 1200, 30, 48, ["twitter", "reddit"], 3.5);
    const b = computeImpactScore(-0.7, 1200, 30, 48, ["twitter", "reddit"], 3.5);
    expect(a).toBe(b);
  });

  it("high engagement + negative sentiment + viral channels = high score", () => {
    const score = computeImpactScore(-0.8, 5000, 50, 24, ["twitter", "reddit", "instagram"], 4);
    expect(score).toBeGreaterThan(60);
  });

  it("low engagement + neutral sentiment + low-risk channel = low score", () => {
    const score = computeImpactScore(0.1, 10, 5, 48, ["nykaa"], 1);
    expect(score).toBeLessThan(35);
  });

  it("score is capped at 100", () => {
    const score = computeImpactScore(-1, 100_000, 1000, 1, ["twitter", "reddit", "instagram", "google"], 10);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("score is at least 0", () => {
    const score = computeImpactScore(1, 0, 0, 48, [], 0);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
