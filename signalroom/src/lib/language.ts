// Lightweight language detection using character/word heuristics

// Common Hindi/Hinglish words
const HINDI_WORDS = new Set([
  "hai", "nahi", "bahut", "accha", "acha", "bura", "bohot", "bilkul",
  "theek", "kaam", "nahi", "baar", "agar", "mujhe", "mera", "mere",
  "iska", "uska", "kya", "kyun", "kaise", "kab", "aur", "lekin",
  "par", "toh", "haan", "yaar", "bhai", "dost", "sahi", "galat",
  "achha", "bekar", "bakwaas", "zyada", "thoda", "bilkul", "zaroor",
]);

const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

export function detectLanguage(text: string): string {
  // Check for Devanagari script
  if (DEVANAGARI_RANGE.test(text)) return "hi";
  
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  
  // Count Hindi/Hinglish words
  const hindiCount = words.filter(w => HINDI_WORDS.has(w)).length;
  const hindiRatio = hindiCount / Math.max(words.length, 1);
  
  if (hindiRatio > 0.15) return "hi-en"; // Hinglish
  
  return "en";
}
