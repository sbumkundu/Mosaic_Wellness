// TF-IDF narrative clustering for grouping similar mentions into "Stories"

export interface ClusterInput {
  id: string;
  text: string;
  topIssue: string | null;
  timestamp: Date;
  product: string | null;
}

export interface NarrativeCluster {
  id: string;
  title: string;
  mentionIds: string[];
  products: string[];
  topIssue: string;
  firstSeen: Date;
  growthRate: number; // mentions per day
}

// Compute TF-IDF vectors
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

const STOPWORDS = new Set([
  "this", "that", "with", "from", "they", "have", "been", "were", "will",
  "would", "could", "should", "their", "there", "about", "which", "what",
  "when", "where", "very", "just", "also", "your", "product", "brand",
  "mosaic", "wellness", "mosaicwellness", "ordered", "order", "received",
]);

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  for (const [k, v] of Array.from(tf)) {
    tf.set(k, v / tokens.length);
  }
  return tf;
}

function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
  let dot = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const [k, v] of Array.from(vec1)) {
    dot += v * (vec2.get(k) || 0);
    mag1 += v * v;
  }
  for (const [, v] of Array.from(vec2)) {
    mag2 += v * v;
  }
  
  const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
  return denom === 0 ? 0 : dot / denom;
}

function generateTitle(mentions: ClusterInput[]): string {
  // Find most common meaningful words across texts
  const wordCounts = new Map<string, number>();
  for (const m of mentions) {
    const tokens = new Set(tokenize(m.text));
    for (const t of Array.from(tokens)) {
      wordCounts.set(t, (wordCounts.get(t) || 0) + 1);
    }
  }
  
  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
  
  const issueLabels: Record<string, string> = {
    delivery: "Delivery Issues",
    packaging: "Packaging Complaints",
    product_quality: "Product Quality Concerns",
    side_effects: "Adverse Reactions Reported",
    trust_authenticity: "Authenticity / Counterfeit Reports",
    pricing: "Pricing Complaints",
    support: "Customer Support Issues",
  };
  
  const topIssue = mentions[0]?.topIssue;
  const issueTitle = topIssue ? issueLabels[topIssue] || topIssue : "Mixed Issues";
  
  return topWords.length > 0 ? `${issueTitle}: ${topWords.join(", ")}` : issueTitle;
}

export function clusterMentions(mentions: ClusterInput[], minClusterSize = 2, similarityThreshold = 0.25): NarrativeCluster[] {
  if (mentions.length === 0) return [];
  
  // Compute TF vectors
  const vectors = mentions.map(m => ({
    id: m.id,
    tokens: tokenize(m.text),
    tf: computeTF(tokenize(m.text)),
    mention: m,
  }));
  
  // Simple greedy clustering
  const assigned = new Set<string>();
  const clusters: Array<{ items: typeof vectors }> = [];
  
  for (let i = 0; i < vectors.length; i++) {
    if (assigned.has(vectors[i].id)) continue;
    
    const cluster = [vectors[i]];
    assigned.add(vectors[i].id);
    
    for (let j = i + 1; j < vectors.length; j++) {
      if (assigned.has(vectors[j].id)) continue;
      
      // Same issue type boosts similarity
      const sameIssue = vectors[i].mention.topIssue === vectors[j].mention.topIssue ? 0.15 : 0;
      const textSim = cosineSimilarity(vectors[i].tf, vectors[j].tf);
      
      if (textSim + sameIssue >= similarityThreshold) {
        cluster.push(vectors[j]);
        assigned.add(vectors[j].id);
      }
    }
    
    clusters.push({ items: cluster });
  }
  
  // Filter small clusters and build result
  return clusters
    .filter(c => c.items.length >= minClusterSize)
    .map(c => {
      const mentionObjs = c.items.map(i => i.mention);
      const firstSeen = new Date(Math.min(...mentionObjs.map(m => new Date(m.timestamp).getTime())));
      const lastSeen = new Date(Math.max(...mentionObjs.map(m => new Date(m.timestamp).getTime())));
      const spanDays = Math.max(1, (lastSeen.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
      const growthRate = mentionObjs.length / spanDays;
      
      const products = Array.from(new Set(mentionObjs.map(m => m.product).filter(Boolean))) as string[];
      
      // Find most common issue
      const issueCounts = new Map<string, number>();
      for (const m of mentionObjs) {
        if (m.topIssue) issueCounts.set(m.topIssue, (issueCounts.get(m.topIssue) || 0) + 1);
      }
      const topIssue = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
      
      return {
        id: crypto.randomUUID(),
        title: generateTitle(mentionObjs),
        mentionIds: mentionObjs.map(m => m.id),
        products,
        topIssue,
        firstSeen,
        growthRate,
      };
    })
    .sort((a, b) => b.mentionIds.length - a.mentionIds.length);
}
