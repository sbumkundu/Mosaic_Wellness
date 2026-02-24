import { describe, it, expect } from "vitest";
import { scoreText } from "../lib/incidents/narrativeRisk";

describe("Narrative risk trigger detection", () => {
  it("detects fraud_scam trigger", () => {
    const { score, triggers } = scoreText("This company is a total scam, they took my money");
    expect(score).toBeGreaterThan(0);
    expect(triggers).toContain("fraud_scam");
  });

  it("detects boycott_cta trigger", () => {
    const { score, triggers } = scoreText("Everyone boycott this brand! Share this and warn everyone!");
    expect(triggers).toContain("boycott_cta");
    expect(score).toBeGreaterThan(2);
  });

  it("detects moral_framing trigger", () => {
    const { score, triggers } = scoreText("They don't care about their customers at all, just hiding the truth");
    expect(triggers).toContain("moral_framing");
  });

  it("detects safety_alarm trigger", () => {
    const { score, triggers } = scoreText("This product is unsafe and I will sue them and file an FIR");
    expect(triggers).toContain("safety_alarm");
  });

  it("returns zero score for neutral text", () => {
    const { score, triggers } = scoreText("The packaging was slightly delayed but eventually arrived fine.");
    expect(score).toBe(0);
    expect(triggers).toHaveLength(0);
  });

  it("accumulates score for multiple triggers", () => {
    const { score } = scoreText(
      "Complete scam, they don't care, boycott this brand, going viral everywhere!"
    );
    expect(score).toBeGreaterThan(5);
  });
});
