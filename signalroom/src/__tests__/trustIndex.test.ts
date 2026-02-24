import { describe, it, expect } from "vitest";
import { extractTrustSignals } from "../lib/health/trustIndex";

describe("Trust signal extraction", () => {
  it("detects refundMention", () => {
    const s = extractTrustSignals("I want a full refund for this terrible product");
    expect(s.refundMention).toBe(true);
    expect(s.fakeClaim).toBe(false);
  });

  it("detects churnIntent", () => {
    const s = extractTrustSignals("I am never ordering from here again after this experience");
    expect(s.churnIntent).toBe(true);
  });

  it("detects fraudClaim", () => {
    const s = extractTrustSignals("This company is a complete scam, they cheated me");
    expect(s.fraudClaim).toBe(true);
  });

  it("detects fakeClaim", () => {
    const s = extractTrustSignals("Looks like a fake product, the seal was broken and it smells different");
    expect(s.fakeClaim).toBe(true);
  });

  it("detects supportFailure", () => {
    const s = extractTrustSignals("Customer support didn't help at all, been waiting for days and no response");
    expect(s.supportFailure).toBe(true);
  });

  it("returns all false for neutral positive text", () => {
    const s = extractTrustSignals("Great product, very happy with it!");
    expect(s.refundMention).toBe(false);
    expect(s.fakeClaim).toBe(false);
    expect(s.churnIntent).toBe(false);
    expect(s.supportFailure).toBe(false);
    expect(s.fraudClaim).toBe(false);
  });

  it("detects multiple signals simultaneously", () => {
    const s = extractTrustSignals(
      "This is a complete scam. I want a refund and I am never buying from you again."
    );
    expect(s.fraudClaim).toBe(true);
    expect(s.refundMention).toBe(true);
    expect(s.churnIntent).toBe(true);
  });
});
