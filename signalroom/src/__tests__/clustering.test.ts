import { describe, it, expect } from "vitest";
import { clusterMentions, ClusterInput } from "../lib/clustering";

function makeMention(id: string, text: string, issue: string | null = null): ClusterInput {
  return { id, text, topIssue: issue, timestamp: new Date("2024-01-15T10:00:00Z"), product: null };
}

describe("Clustering outputs stable shape", () => {
  it("returns empty array for empty input", () => {
    expect(clusterMentions([])).toEqual([]);
  });

  it("clusters very similar texts together", () => {
    const mentions = [
      makeMention("1", "My delivery was extremely late and package never arrived", "delivery"),
      makeMention("2", "Delivery was very late, order never arrived at all", "delivery"),
      makeMention("3", "Completely different topic about product quality and texture", "product_quality"),
      makeMention("4", "Product texture is bad and quality is very poor", "product_quality"),
    ];
    const clusters = clusterMentions(mentions, 2, 0.2);
    // Should form at least one cluster
    expect(clusters.length).toBeGreaterThan(0);
    // Each cluster has required fields
    for (const c of clusters) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("title");
      expect(c.mentionIds.length).toBeGreaterThanOrEqual(2);
      expect(c).toHaveProperty("firstSeen");
      expect(c).toHaveProperty("growthRate");
    }
  });

  it("does not cluster completely dissimilar texts", () => {
    const mentions = [
      makeMention("a", "excellent superb amazing wonderful great product quality", "product_quality"),
      makeMention("b", "delivery partner address route tracking shipment", "delivery"),
      makeMention("c", "refund return chargeback dispute cancel order payment", "pricing"),
    ];
    // With high similarity threshold, should produce no clusters >= minSize 3
    const clusters = clusterMentions(mentions, 3, 0.6);
    expect(clusters.every(c => c.mentionIds.length < 3)).toBe(true);
  });

  it("clusters are sorted by size (largest first)", () => {
    const mentions = [
      makeMention("1", "delivery delayed late never arrived waiting package", "delivery"),
      makeMention("2", "delivery very late order still not arrived", "delivery"),
      makeMention("3", "delivery delay package waiting long time", "delivery"),
      makeMention("4", "fake product counterfeit seal broken", "trust_authenticity"),
      makeMention("5", "fake seal broken looks counterfeit", "trust_authenticity"),
    ];
    const clusters = clusterMentions(mentions, 2, 0.15);
    if (clusters.length >= 2) {
      expect(clusters[0].mentionIds.length).toBeGreaterThanOrEqual(clusters[1].mentionIds.length);
    }
  });
});
