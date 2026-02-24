// Anomaly detection: Robust Z-score + EWMA for crisis prediction

export interface TimeSeriesPoint {
  hour: string; // ISO hour
  count: number;
  negCount: number;
  avgSentiment: number;
  totalEngagement: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  ewmaScore: number;
  ensembleScore: number; // 0-1, higher = more anomalous
  magnitude: number; // ratio vs baseline mean
  confidence: number;
}

// Robust Z-score using median and MAD
function robustZScore(values: number[], currentValue: number): number {
  if (values.length < 3) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted.map(v => Math.abs(v - median));
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
  
  if (mad === 0) return 0;
  
  // Scale factor 0.6745 makes MAD comparable to std dev
  return (currentValue - median) / (mad * 1.4826);
}

// EWMA - Exponentially Weighted Moving Average
function ewmaControl(values: number[], currentValue: number, lambda = 0.3): number {
  if (values.length < 2) return 0;
  
  let ewma = values[0];
  let ewmaVar = 0;
  
  for (let i = 1; i < values.length; i++) {
    ewma = lambda * values[i] + (1 - lambda) * ewma;
    ewmaVar = lambda * Math.pow(values[i] - ewma, 2) + (1 - lambda) * ewmaVar;
  }
  
  const ewmaStd = Math.sqrt(ewmaVar);
  if (ewmaStd === 0) return 0;
  
  // How many std devs is current from EWMA?
  return (currentValue - ewma) / ewmaStd;
}

export function detectAnomaly(
  baselinePoints: TimeSeriesPoint[], // 14 days history
  currentPoints: TimeSeriesPoint[],  // recent window
  metric: "count" | "negCount" | "avgSentiment" = "negCount"
): AnomalyResult {
  if (baselinePoints.length < 5) {
    return { isAnomaly: false, zScore: 0, ewmaScore: 0, ensembleScore: 0, magnitude: 1, confidence: 0 };
  }
  
  const baselineValues = baselinePoints.map(p => p[metric]);
  const currentTotal = currentPoints.reduce((s: number, p: TimeSeriesPoint) => s + p[metric], 0);
  const currentAvg = currentPoints.length > 0 ? currentTotal / currentPoints.length : 0;
  
  // For sentiment, lower is worse (anomalous)
  const analysisValue = metric === "avgSentiment" ? -currentAvg : currentAvg;
  const analysisBaseline = metric === "avgSentiment" 
    ? baselineValues.map(v => -v) 
    : baselineValues;
  
  const zScore = robustZScore(analysisBaseline, analysisValue);
  const ewmaScore = ewmaControl(analysisBaseline, analysisValue);
  
  // Ensemble: weighted combination
  const ensembleScore = Math.max(0, Math.min(1, 
    (Math.abs(zScore) * 0.6 + Math.abs(ewmaScore) * 0.4) / 5
  ));
  
  // Magnitude: ratio to baseline mean
  const baselineMean = baselineValues.reduce((s: number, v: number) => s + v, 0) / baselineValues.length;
  const magnitude = baselineMean > 0 ? currentAvg / baselineMean : currentAvg > 0 ? 3 : 1;
  
  const isAnomaly = (Math.abs(zScore) > 2.5 || Math.abs(ewmaScore) > 3) && currentAvg > 0;
  
  // Confidence based on z-score magnitude and data volume
  const confidence = Math.min(0.95, Math.max(0.3, 
    0.3 + Math.min(Math.abs(zScore) / 6, 0.5) + (baselinePoints.length > 20 ? 0.15 : 0)
  ));
  
  return { isAnomaly, zScore, ewmaScore, ensembleScore, magnitude, confidence };
}

export function detectCrossChannelContagion(
  mentions: Array<{ channel: string; timestamp: Date; topIssue: string | null }>,
  windowHours = 12
): Array<{ issue: string; channels: string[]; firstSeen: Date; severity: number }> {
  const windowMs = windowHours * 60 * 60 * 1000;
  const now = Date.now();
  
  const recentMentions = mentions.filter(m => 
    now - new Date(m.timestamp).getTime() < windowMs && m.topIssue
  );
  
  // Group by issue
  const byIssue = new Map<string, Set<string>>();
  const issueFirstSeen = new Map<string, Date>();
  
  for (const m of recentMentions) {
    if (!m.topIssue) continue;
    if (!byIssue.has(m.topIssue)) byIssue.set(m.topIssue, new Set());
    byIssue.get(m.topIssue)!.add(m.channel);
    
    const existing = issueFirstSeen.get(m.topIssue);
    const ts = new Date(m.timestamp);
    if (!existing || ts < existing) {
      issueFirstSeen.set(m.topIssue, ts);
    }
  }
  
  const results: Array<{ issue: string; channels: string[]; firstSeen: Date; severity: number }> = [];
  
  for (const [issue, channels] of Array.from(byIssue)) {
    if (channels.size >= 2) {
      results.push({
        issue,
        channels: Array.from(channels),
        firstSeen: issueFirstSeen.get(issue) || new Date(),
        severity: channels.size / 6, // 6 total channels
      });
    }
  }
  
  return results;
}
