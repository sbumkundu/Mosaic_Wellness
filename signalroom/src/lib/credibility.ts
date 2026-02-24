// Credibility score (0-100) for each mention

export interface CredibilityFactors {
  textLength: number;
  hasOrderId: boolean;
  hasSpecificDetails: boolean;
  rating?: number;
  engagement: number;
  channel: string;
  isVerified: boolean;
  hasSarcasm: boolean;
  hasRepeatedText: boolean;
}

// Channel base scores
const CHANNEL_BASE: Record<string, number> = {
  amazon: 70,    // verified purchase possible
  nykaa: 65,
  google: 60,
  reddit: 50,
  twitter: 40,
  instagram: 35,
  complaints: 75, // internal complaints are high credibility
};

export function computeCredibilityScore(factors: CredibilityFactors): number {
  let score = CHANNEL_BASE[factors.channel] ?? 50;
  
  // Text length bonus (longer = more detailed = more credible)
  if (factors.textLength > 200) score += 10;
  else if (factors.textLength > 100) score += 5;
  else if (factors.textLength < 20) score -= 15;
  
  // Has order ID = very credible
  if (factors.hasOrderId) score += 15;
  
  // Specific details (dates, amounts, names)
  if (factors.hasSpecificDetails) score += 8;
  
  // Verified purchase/account
  if (factors.isVerified) score += 12;
  
  // High engagement = more reach (slightly more credible, others agreed)
  if (factors.engagement > 100) score += 8;
  else if (factors.engagement > 20) score += 4;
  
  // Sarcasm / ambiguous signals lower credibility slightly
  if (factors.hasSarcasm) score -= 5;
  
  // Repeated text pattern = spam signal
  if (factors.hasRepeatedText) score -= 25;
  
  // Rating: extreme ratings without text are less credible
  if (factors.rating !== undefined) {
    const textLengthOk = factors.textLength > 50;
    if ((factors.rating === 1 || factors.rating === 5) && !textLengthOk) {
      score -= 10; // extreme rating with no explanation
    }
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function hasRepeatedText(text: string): boolean {
  // Check if same phrase is repeated 3+ times
  const words = text.toLowerCase().split(/\s+/);
  if (words.length < 6) return false;
  
  // Sliding window of 3 words
  const windows = new Map<string, number>();
  for (let i = 0; i <= words.length - 3; i++) {
    const window = words.slice(i, i + 3).join(" ");
    windows.set(window, (windows.get(window) || 0) + 1);
    if ((windows.get(window) || 0) >= 3) return true;
  }
  return false;
}

export function hasSpecificDetails(text: string): boolean {
  const patterns = [
    /\b(?:order|invoice|receipt|ref|reference)\s*(?:#|no\.?|id|number)?\s*:?\s*[A-Z0-9]{4,}/i,
    /\b(rs\.?|inr|₹)\s*\d+/i,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,  // date
    /\bcalled|emailed|chatted|spoke to|agent|ticket\b/i,
    /\b(batch|lot|mfg|expiry|best before)\b/i,
  ];
  return patterns.some(p => p.test(text));
}

export function estimateBlastRadius(
  sentimentScore: number,
  engagement: number,
  credibilityScore: number,
  crossChannelCount: number
): "contained" | "watch" | "high_risk" {
  let riskScore = 0;
  
  // Negative sentiment amplifies risk
  if (sentimentScore < -0.5) riskScore += 3;
  else if (sentimentScore < -0.2) riskScore += 1;
  
  // High engagement = more reach
  if (engagement > 500) riskScore += 4;
  else if (engagement > 100) riskScore += 2;
  else if (engagement > 20) riskScore += 1;
  
  // Credibility: credible negative = more dangerous
  if (credibilityScore > 70) riskScore += 2;
  else if (credibilityScore > 50) riskScore += 1;
  
  // Cross-channel = going viral
  if (crossChannelCount >= 3) riskScore += 5;
  else if (crossChannelCount >= 2) riskScore += 2;
  
  if (riskScore >= 7) return "high_risk";
  if (riskScore >= 3) return "watch";
  return "contained";
}
