// Multi-label issue taxonomy classifier
// Returns list of {issue, confidence} pairs

export type IssueType =
  | "product_quality"
  | "delivery"
  | "packaging"
  | "pricing"
  | "support"
  | "side_effects"
  | "trust_authenticity";

export interface IssueLabel {
  issue: IssueType;
  confidence: number;
}

const ISSUE_PATTERNS: Record<IssueType, { patterns: RegExp[]; weight: number }> = {
  product_quality: {
    weight: 1,
    patterns: [
      /\b(quality|texture|consistency|formula|formula|ineffective|not working|no effect|useless|expired|watered down|thin|sticky|greasy|absorb|smell|odor|colour|color|color changed|discolored)\b/i,
      /\b(fake|counterfeit|duplicate|not genuine|not original|copy|replica|adulterated)\b/i,
      /\b(doesn't work|didn't work|no results|no improvement|same as before|waste of money|not effective)\b/i,
      /\b(batch|lot number|manufacturing|expiry|best before)\b/i,
    ],
  },
  delivery: {
    weight: 1,
    patterns: [
      /\b(delivery|deliver|shipping|shipped|courier|dispatch|transit|tracking|track)\b/i,
      /\b(late|delayed|delay|slow|took days|weeks|never arrived|not delivered|missing|lost|wrong address)\b/i,
      /\b(delhivery|bluedart|dunzo|ekart|amazon logistics|xpressbees|shadowfax)\b/i,
      /\b(still waiting|where is my order|order not received|delivery partner|out for delivery)\b/i,
    ],
  },
  packaging: {
    weight: 0.8,
    patterns: [
      /\b(packaging|package|box|bottle|container|seal|sealed|broken|cracked|leaked|leak|spilled|damaged|dented)\b/i,
      /\b(tamper|tampered|open|opened|used|second hand|repackaged)\b/i,
      /\b(outer box|inner packing|bubble wrap|protection|poorly packed)\b/i,
    ],
  },
  pricing: {
    weight: 0.7,
    patterns: [
      /\b(price|pricing|cost|expensive|overpriced|cheap|value|worth|money|rupees|rs\.|inr)\b/i,
      /\b(not worth|too expensive|price hike|cheaper|better deal|discount|offer|coupon)\b/i,
      /\b(refund|return|exchange|money back|chargeback)\b/i,
    ],
  },
  support: {
    weight: 0.8,
    patterns: [
      /\b(customer service|customer support|customer care|helpdesk|support team|agent|representative)\b/i,
      /\b(rude|unhelpful|no response|didn't respond|ignored|escalate|complaint|ticket|raised)\b/i,
      /\b(chat|call|email|whatsapp|support number|helpline|contact)\b/i,
    ],
  },
  side_effects: {
    weight: 1.2,
    patterns: [
      /\b(rash|rashes|breakout|breakouts|acne|pimple|pimples|allerg|allergic|reaction|irritation|irritated|redness|red skin|burning|itch|itching|itchy)\b/i,
      /\b(side effect|side-effect|adverse|hairfall|hair fall|hair loss|thinning)\b/i,
      /\b(stomach|nausea|vomit|headache|dizziness|pain|swelling|hives|blister)\b/i,
    ],
  },
  trust_authenticity: {
    weight: 1.3,
    patterns: [
      /\b(fake|counterfeit|duplicate|not genuine|not original|replica|adulterated|tampered)\b/i,
      /\b(fraud|scam|cheated|lied|misleading|false claims|mislead)\b/i,
      /\b(fssai|lab test|tested|certificate|authentic|original product|seal broken)\b/i,
      /\b(suspicious|doubt|unsure|not sure if real|looks fake|smells different|different from before)\b/i,
    ],
  },
};

export function classifyIssues(text: string): IssueLabel[] {
  const results: IssueLabel[] = [];
  
  for (const [issue, { patterns, weight }] of Object.entries(ISSUE_PATTERNS) as [IssueType, { patterns: RegExp[]; weight: number }][]) {
    let matchCount = 0;
    let totalPatterns = patterns.length;
    
    for (const pattern of patterns) {
      const matches = text.match(new RegExp(pattern.source, "gi"));
      if (matches) {
        matchCount += Math.min(matches.length, 3); // cap at 3 per pattern
      }
    }
    
    if (matchCount > 0) {
      // Confidence based on match density vs text length
      const textLength = text.split(/\s+/).length;
      const density = matchCount / Math.max(textLength / 20, 1);
      const rawConfidence = Math.tanh(density * weight * 1.5);
      const confidence = Math.min(Math.max(rawConfidence, 0.3), 0.98);
      
      results.push({ issue, confidence });
    }
  }
  
  // Sort by confidence desc
  results.sort((a, b) => b.confidence - a.confidence);
  
  return results;
}

export function getTopIssue(labels: IssueLabel[]): IssueType | null {
  return labels.length > 0 ? labels[0].issue : null;
}
