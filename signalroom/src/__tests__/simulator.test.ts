import { describe, it, expect } from "vitest";

const HORIZON_HOURS = 48;

function baselineDecay(
  startVolume: number,
  startNegShare: number,
  startTrust: number,
  startNarrativeRisk: number,
) {
  const volHalfLifeHours = 120;
  const lambda = Math.log(2) / volHalfLifeHours;
  const series = [];
  for (let h = 0; h < HORIZON_HOURS; h++) {
    series.push({
      hour: h,
      volume: Math.max(0, startVolume * Math.exp(-lambda * h)),
      negShare: startNegShare * (0.95 ** (h / 8)),
      trustIndex: Math.min(100, startTrust + (50 - startTrust) * (h / HORIZON_HOURS) * 0.2),
      narrativeRisk: Math.max(0, startNarrativeRisk * (0.97 ** (h / 4))),
    });
  }
  return series;
}

describe("Simulator series", () => {
  it("returns exactly 48 data points", () => {
    const series = baselineDecay(100, 0.6, 55, 40);
    expect(series).toHaveLength(HORIZON_HOURS);
  });

  it("volume decays over time (not increases)", () => {
    const series = baselineDecay(100, 0.6, 55, 40);
    expect(series[0].volume).toBeGreaterThan(series[HORIZON_HOURS - 1].volume);
  });

  it("negative share decreases monotonically", () => {
    const series = baselineDecay(100, 0.6, 55, 40);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].negShare).toBeLessThanOrEqual(series[i - 1].negShare + 0.001);
    }
  });

  it("all points have the four required fields", () => {
    const series = baselineDecay(50, 0.4, 60, 30);
    for (const pt of series) {
      expect(pt).toHaveProperty("hour");
      expect(pt).toHaveProperty("volume");
      expect(pt).toHaveProperty("negShare");
      expect(pt).toHaveProperty("trustIndex");
      expect(pt).toHaveProperty("narrativeRisk");
    }
  });

  it("hour values are sequential 0..47", () => {
    const series = baselineDecay(80, 0.5, 50, 25);
    series.forEach((pt, i) => expect(pt.hour).toBe(i));
  });
});
