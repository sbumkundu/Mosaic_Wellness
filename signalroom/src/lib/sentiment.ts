// Deterministic sentiment + sarcasm detection — no LLM required
// Uses AFINN-style word lists augmented with domain-specific terms

const POSITIVE_WORDS: Record<string, number> = {
  excellent: 3, amazing: 3, fantastic: 3, outstanding: 3, superb: 3, wonderful: 3,
  great: 2, good: 2, love: 2, loved: 2, beautiful: 2, best: 2, perfect: 2,
  nice: 1, fine: 1, okay: 1, decent: 1, smooth: 1, effective: 1, works: 1,
  recommend: 2, recommended: 2, happy: 2, satisfied: 2, pleased: 2, impressed: 2,
  glowing: 2, radiant: 2, moisturized: 1, hydrated: 1, nourished: 1, soft: 1,
  "worth it": 2, "value for money": 2, "good quality": 2, "fast delivery": 2,
  delivered: 1, genuine: 1, authentic: 1, original: 1,
};

const NEGATIVE_WORDS: Record<string, number> = {
  terrible: -3, horrible: -3, awful: -3, worst: -3, disgusting: -3, pathetic: -3,
  bad: -2, poor: -2, waste: -2, fake: -2, fraud: -2, scam: -2, counterfeit: -2,
  broken: -2, damaged: -2, destroyed: -2, ruined: -2, rash: -2, irritation: -2,
  redness: -2, allergic: -2, reaction: -2, side: -1, effects: -1,
  disappointed: -2, disappointing: -2, dissatisfied: -2, upset: -2, angry: -2,
  frustrated: -2, disgusted: -2, useless: -2, ineffective: -2,
  late: -1, delayed: -2, lost: -2, missing: -2, wrong: -2, expired: -3,
  "not working": -2, "doesn't work": -2, "did not work": -2, "no effect": -2,
  "side effects": -3, "broke out": -2, "breakout": -2, "acne": -1,
  "never arrived": -3, "still waiting": -2, "returned": -1, "refund": -1,
  "money back": -1, "cheated": -3, "lied": -2, "misleading": -2,
  "not genuine": -3, "not original": -3, "duplicate": -3,
  "customer service": -0.5, "support": -0.5,
};

const NEGATION_WORDS = new Set(["not", "no", "never", "don't", "doesn't", "didn't", "isn't", "wasn't", "won't", "can't", "cannot", "hardly", "barely", "scarcely"]);
const INTENSIFIERS = new Set(["very", "extremely", "absolutely", "totally", "completely", "utterly", "really", "super", "so"]);
const SARCASM_PATTERNS = [
  /\b(oh great|oh wow|wow thanks|love how|great job|brilliant|genius|amazing how)\b.{0,40}(damaged|broken|late|lost|fake|wrong|terrible|awful|worst)/i,
  /\b5 stars?\b.{0,60}(terrible|awful|worst|damaged|broken|fake|scam)/i,
  /\b(thanks for nothing|best.{0,10}money wasted|super (helpful|fast|efficient).{0,20}(not|never))\b/i,
  /just what i (needed|wanted).{0,40}(broken|damaged|wrong|expired)/i,
];

export interface SentimentResult {
  score: number;        // -1 to +1
  label: "pos" | "neutral" | "neg";
  confidence: number;   // 0 to 1
  hasSarcasm: boolean;
}

export function analyzeSentiment(text: string, rating?: number): SentimentResult {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  
  // Check sarcasm first
  const hasSarcasm = SARCASM_PATTERNS.some(p => p.test(lower));
  
  let rawScore = 0;
  let wordCount = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : "";
    const prev2Word = i > 1 ? words[i - 2] : "";
    
    let wordScore = 0;
    
    // Check single word
    if (POSITIVE_WORDS[word]) wordScore = POSITIVE_WORDS[word];
    else if (NEGATIVE_WORDS[word]) wordScore = NEGATIVE_WORDS[word];
    
    // Check 2-word phrases
    const phrase2 = i > 0 ? `${words[i-1]} ${word}` : "";
    if (phrase2 && POSITIVE_WORDS[phrase2]) wordScore = POSITIVE_WORDS[phrase2];
    if (phrase2 && NEGATIVE_WORDS[phrase2]) wordScore = NEGATIVE_WORDS[phrase2];
    
    // Apply negation
    if (wordScore !== 0 && (NEGATION_WORDS.has(prevWord) || NEGATION_WORDS.has(prev2Word))) {
      wordScore *= -0.8;
    }
    
    // Apply intensifier
    if (wordScore !== 0 && (INTENSIFIERS.has(prevWord) || INTENSIFIERS.has(prev2Word))) {
      wordScore *= 1.5;
    }
    
    rawScore += wordScore;
    if (wordScore !== 0) wordCount++;
  }
  
  // Normalize to -1..+1
  let score = wordCount > 0 ? Math.tanh(rawScore / Math.max(wordCount, 3)) : 0;
  
  // Blend with rating if available
  if (rating !== undefined) {
    const ratingScore = (rating - 3) / 2; // 1→-1, 3→0, 5→+1
    score = score * 0.6 + ratingScore * 0.4;
  }
  
  // Invert if sarcasm detected
  if (hasSarcasm) {
    score = score * -1;
  }
  
  // Clamp
  score = Math.max(-1, Math.min(1, score));
  
  let label: "pos" | "neutral" | "neg";
  if (score >= 0.15) label = "pos";
  else if (score <= -0.15) label = "neg";
  else label = "neutral";
  
  // Confidence: high if score extreme, low if mixed signals or sarcasm
  const absScore = Math.abs(score);
  let confidence = 0.5 + absScore * 0.4;
  if (hasSarcasm) confidence *= 0.7;
  if (rating !== undefined) confidence = Math.min(confidence + 0.1, 1);
  
  return { score, label, confidence, hasSarcasm };
}
