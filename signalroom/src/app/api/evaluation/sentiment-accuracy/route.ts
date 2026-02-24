import { NextResponse } from "next/server";
import { analyzeSentiment } from "@/lib/sentiment";

export const dynamic = "force-dynamic";

// Ground-truth test cases covering EN, HI/Hinglish, sarcasm, and edge tones
const TEST_CASES: Array<{
  text: string;
  rating?: number;
  expected: "pos" | "neutral" | "neg";
  language: "en" | "hi";
  tone: "positive" | "negative" | "neutral" | "sarcasm";
}> = [
  // English — Positive
  { text: "Absolutely love this product! My skin feels amazing and so moisturized.", rating: 5, expected: "pos", language: "en", tone: "positive" },
  { text: "Fast delivery, genuine product, really satisfied with the quality.", rating: 5, expected: "pos", language: "en", tone: "positive" },
  { text: "Best serum I've ever used. Highly recommend to anyone.", rating: 5, expected: "pos", language: "en", tone: "positive" },
  { text: "Great value for money. Works exactly as described.", rating: 4, expected: "pos", language: "en", tone: "positive" },
  { text: "Beautiful packaging, effective formula, smells wonderful.", rating: 5, expected: "pos", language: "en", tone: "positive" },
  { text: "Skin looks radiant and feels hydrated. Will order again.", rating: 5, expected: "pos", language: "en", tone: "positive" },
  { text: "Excellent product, really impressed with the results.", rating: 4, expected: "pos", language: "en", tone: "positive" },

  // English — Negative
  { text: "Terrible experience. Product arrived damaged and smells awful.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "This is a fake product. Not the original, complete scam.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "Caused a severe rash on my face. Side effects are horrible.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "Package never arrived. Still waiting after 3 weeks. Worst delivery service.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "Complete waste of money. Product did not work at all.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "Very disappointed. The product broke out my skin badly.", rating: 2, expected: "neg", language: "en", tone: "negative" },
  { text: "Counterfeit product, misleading description. Want refund immediately.", rating: 1, expected: "neg", language: "en", tone: "negative" },
  { text: "Not working at all. Frustrated with no effects after one month.", rating: 2, expected: "neg", language: "en", tone: "negative" },

  // English — Neutral
  { text: "Package was okay. Product seems decent but too early to say.", rating: 3, expected: "neutral", language: "en", tone: "neutral" },
  { text: "Received on time. Using it for a week now, no major issues.", rating: 3, expected: "neutral", language: "en", tone: "neutral" },
  { text: "Average product, neither great nor bad. Will continue for another month.", rating: 3, expected: "neutral", language: "en", tone: "neutral" },

  // English — Sarcasm
  { text: "Oh great, just what I needed — arrived completely broken.", rating: 1, expected: "neg", language: "en", tone: "sarcasm" },
  { text: "5 stars for arriving 3 weeks late and completely terrible packaging!", rating: 1, expected: "neg", language: "en", tone: "sarcasm" },
  { text: "Thanks for nothing. Super helpful customer support — NOT.", rating: 1, expected: "neg", language: "en", tone: "sarcasm" },

  // Hindi / Hinglish — Positive
  { text: "Bahut achha product hai, skin bilkul soft ho gayi. Recommend karenge.", rating: 5, expected: "pos", language: "hi", tone: "positive" },
  { text: "Zabardast result mila ek hafte mein. Genuine product, fast delivery.", rating: 5, expected: "pos", language: "hi", tone: "positive" },
  { text: "Mast product hai yaar, bilkul original lagta hai. Mujhe bahut pasand aaya.", rating: 4, expected: "pos", language: "hi", tone: "positive" },
  { text: "Skin glow kar rahi hai, very happy with results. Paise vasool.", rating: 5, expected: "pos", language: "hi", tone: "positive" },

  // Hindi / Hinglish — Negative
  { text: "Bekar product hai, koi fayda nahi hua. Paisa barbaad ho gaya.", rating: 1, expected: "neg", language: "hi", tone: "negative" },
  { text: "Naqli product bheja hai. Duplicate lagta hai, cheating hai yeh.", rating: 1, expected: "neg", language: "hi", tone: "negative" },
  { text: "Face pe rash aa gaya, bahut irritation ho rahi hai. Side effects hain.", rating: 1, expected: "neg", language: "hi", tone: "negative" },
  { text: "Order nahi aaya abhi tak, bahut late ho gaya hai. Very frustrated.", rating: 1, expected: "neg", language: "hi", tone: "negative" },

  // Hindi — Neutral
  { text: "Theek thak product hai. Abhi use kar rahe hain, dekhte hain.", rating: 3, expected: "neutral", language: "hi", tone: "neutral" },
];

export async function GET() {
  const results = TEST_CASES.map(tc => {
    const result = analyzeSentiment(tc.text, tc.rating);
    return {
      correct: result.label === tc.expected,
      language: tc.language,
      tone: tc.tone,
      expected: tc.expected,
      predicted: result.label,
      confidence: result.confidence,
      hasSarcasm: result.hasSarcasm,
    };
  });

  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const accuracy = Math.round((correct / total) * 100);

  // Per-language breakdown
  const byLanguage: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    if (!byLanguage[r.language]) byLanguage[r.language] = { total: 0, correct: 0 };
    byLanguage[r.language].total++;
    if (r.correct) byLanguage[r.language].correct++;
  }

  // Per-tone breakdown
  const byTone: Record<string, { total: number; correct: number }> = {};
  for (const r of results) {
    if (!byTone[r.tone]) byTone[r.tone] = { total: 0, correct: 0 };
    byTone[r.tone].total++;
    if (r.correct) byTone[r.tone].correct++;
  }

  return NextResponse.json({
    overall: { total, correct, accuracy },
    byLanguage: Object.entries(byLanguage).map(([lang, v]) => ({
      language: lang === "en" ? "English" : "Hindi / Hinglish",
      accuracy: Math.round((v.correct / v.total) * 100),
      tested: v.total,
    })),
    byTone: Object.entries(byTone).map(([tone, v]) => ({
      tone: tone.charAt(0).toUpperCase() + tone.slice(1),
      accuracy: Math.round((v.correct / v.total) * 100),
      tested: v.total,
    })),
    methodology: [
      "AFINN-style word list (50+ positive, 50+ negative domain terms)",
      "Negation handling — 'not good' correctly classified as negative",
      "Intensifier boosting — 'very bad' scores 1.5× higher magnitude",
      "Sarcasm detection via 4 regex patterns (score inversion)",
      "Star-rating fusion — 40% rating weight when available",
      "Hindi/Hinglish: Devanagari script + 30-word Hindi lexicon",
    ],
  });
}
