import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "./db";
import { analyzeSentiment } from "./sentiment";
import { classifyIssues } from "./taxonomy";
import { extractEntities } from "./entities";
import { computeCredibilityScore, estimateBlastRadius, hasRepeatedText, hasSpecificDetails } from "./credibility";
import { detectLanguage } from "./language";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NormalizedMention {
  id: string;
  source: string;
  channel: string;
  authorHandle?: string;
  timestamp: Date;
  language: string;
  text: string;
  product?: string;
  sku?: string;
  orderId?: string;
  deliveryPartner?: string;
  location?: string;
  rating?: number;
  engagement: number;
  url?: string;
  sentimentScore: number;
  sentimentLabel: string;
  issueLabels: string;
  topIssue?: string;
  credibilityScore: number;
  entities: string;
  isSimulated: boolean;
  blastRadius: string;
  hasSarcasm: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Shorten full product names into compact heatmap display names.
 *  e.g. "Be Bodywise Hair Growth Serum Roll On 25ml" → "BB Hair Growth Serum" */
function normalizeProductName(name: string): string {
  return name
    .replace(/^Be Bodywise\s+/i, "BB ")
    .replace(/^Man Matters\s+/i, "MM ")
    .replace(/\bRoll\s+On\b/gi, "")
    .replace(/\bUltra\s+Light\b/gi, "")
    .replace(/\bAdvanced\b/gi, "")
    .replace(/\bfor\s+Hair\s*&\s*Skin\b/gi, "")
    .replace(/\b10%\b/gi, "")
    .replace(/\s+\d+(?:ml|g|ct)\s*$/i, "")
    .replace(/\bSPF\d+\+?/gi, "SPF50")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function dataPath(filename: string): string {
  return path.join(process.cwd(), "data", filename);
}

function safeReadFile(filename: string): string | null {
  try {
    return fs.readFileSync(dataPath(filename), "utf-8");
  } catch {
    return null;
  }
}

function parseCSV<T>(content: string): T[] {
  const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true, dynamicTyping: true });
  return result.data;
}

function processText(
  id: string,
  source: string,
  channel: string,
  text: string,
  opts: {
    authorHandle?: string;
    timestamp: Date;
    rating?: number;
    engagement?: number;
    url?: string;
    isSimulated?: boolean;
  }
): NormalizedMention {
  const lang = detectLanguage(text);
  const sentiment = analyzeSentiment(text, opts.rating);
  const issues = classifyIssues(text);
  const entities = extractEntities(text);
  const engagement = opts.engagement || 0;

  const repeated = hasRepeatedText(text);
  const hasDetails = hasSpecificDetails(text);
  const isVerified = channel === "amazon" || channel === "nykaa";

  const credibility = computeCredibilityScore({
    textLength: text.length,
    hasOrderId: entities.orderIds.length > 0,
    hasSpecificDetails: hasDetails,
    rating: opts.rating,
    engagement,
    channel,
    isVerified,
    hasSarcasm: sentiment.hasSarcasm,
    hasRepeatedText: repeated,
  });

  const topIssue = issues[0]?.issue || undefined;
  const blastRadius = estimateBlastRadius(
    sentiment.score,
    engagement,
    credibility,
    0 // cross-channel computed separately
  );

  const product = entities.products[0]?.name;
  const orderId = entities.orderIds[0];
  const deliveryPartner = entities.deliveryPartners[0]?.name;
  const location = entities.locations[0]?.name;

  return {
    id,
    source,
    channel,
    authorHandle: opts.authorHandle,
    timestamp: opts.timestamp,
    language: lang,
    text,
    product,
    orderId,
    deliveryPartner,
    location,
    rating: opts.rating,
    engagement,
    url: opts.url ? String(opts.url) : undefined,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    issueLabels: JSON.stringify(issues.map(i => ({ issue: i.issue, confidence: i.confidence }))),
    topIssue,
    credibilityScore: credibility,
    entities: JSON.stringify({
      products: entities.products,
      orderIds: entities.orderIds,
      deliveryPartners: entities.deliveryPartners,
      locations: entities.locations,
    }),
    isSimulated: opts.isSimulated || false,
    blastRadius,
    hasSarcasm: sentiment.hasSarcasm,
  };
}

// ── Channel Ingestion ──────────────────────────────────────────────────────────

async function ingestAmazon(source: string): Promise<number> {
  const content = safeReadFile("reviews_amazon.csv");
  if (!content) return 0;

  const rows = parseCSV<any>(content);
  let count = 0;

  for (const row of rows) {
    if (!row.text && !row.review_text) continue;
    const rawText = (row.text || row.review_text || "").toString();
    const title = row.title ? row.title.toString() : "";
    const text = title ? `${title}. ${rawText}` : rawText;
    const id = `amazon-${row.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "amazon", text, {
      authorHandle: row.author || row.reviewer,
      timestamp: new Date(row.timestamp || row.date || Date.now()),
      rating: parseFloat(row.rating) || undefined,
      engagement: parseInt(row.helpful_votes) || 0,
      url: row.url,
    });

    if (row.product) mention.product = normalizeProductName(row.product.toString());

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestNykaa(source: string): Promise<number> {
  const content = safeReadFile("reviews_nykaa.csv");
  if (!content) return 0;

  const rows = parseCSV<any>(content);
  let count = 0;

  for (const row of rows) {
    if (!row.text) continue;
    const rawText = row.text.toString();
    const title = row.title ? row.title.toString() : "";
    const text = title ? `${title}. ${rawText}` : rawText;
    const id = `nykaa-${row.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "nykaa", text, {
      authorHandle: row.author,
      timestamp: new Date(row.timestamp || Date.now()),
      rating: parseFloat(row.rating) || undefined,
      engagement: parseInt(row.helpful_votes) || 0,
      url: row.url,
    });

    if (row.product) mention.product = normalizeProductName(row.product.toString());

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestGoogle(source: string): Promise<number> {
  const content = safeReadFile("reviews_google.csv");
  if (!content) return 0;

  const rows = parseCSV<any>(content);
  let count = 0;

  for (const row of rows) {
    if (!row.text) continue;
    const id = `google-${row.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "google", row.text.toString(), {
      authorHandle: row.author,
      timestamp: new Date(row.timestamp || Date.now()),
      rating: parseFloat(row.rating) || undefined,
      engagement: 0,
      url: row.url,
      isSimulated: false,
    });
    mention.location = mention.location || row.location;

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestReddit(source: string): Promise<number> {
  const content = safeReadFile("reddit.json");
  if (!content) return 0;

  let posts: any[] = [];
  try { posts = JSON.parse(content); } catch { return 0; }
  let count = 0;

  for (const post of posts) {
    const text = [post.title, post.text].filter(Boolean).join(" — ");
    if (!text.trim()) continue;
    const id = `reddit-${post.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "reddit", text, {
      authorHandle: post.author,
      timestamp: new Date(post.timestamp || Date.now()),
      engagement: (parseInt(post.upvotes) || 0) + (parseInt(post.comments) || 0),
      url: post.url,
    });

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestTwitter(source: string): Promise<number> {
  const content = safeReadFile("twitter.json");
  if (!content) return 0;

  let tweets: any[] = [];
  try { tweets = JSON.parse(content); } catch { return 0; }
  let count = 0;

  for (const tweet of tweets) {
    if (!tweet.text) continue;
    const id = `twitter-${tweet.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "twitter", tweet.text, {
      authorHandle: tweet.author,
      timestamp: new Date(tweet.timestamp || Date.now()),
      engagement: (parseInt(tweet.likes) || 0) + (parseInt(tweet.retweets) || 0) + (parseInt(tweet.replies) || 0),
      url: tweet.url,
    });

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestInstagram(source: string): Promise<number> {
  const content = safeReadFile("instagram.json");
  if (!content) return 0;

  let posts: any[] = [];
  try { posts = JSON.parse(content); } catch { return 0; }
  let count = 0;

  for (const post of posts) {
    if (!post.caption) continue;
    const id = `instagram-${post.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "instagram", post.caption, {
      authorHandle: post.author,
      timestamp: new Date(post.timestamp || Date.now()),
      engagement: (parseInt(post.likes) || 0) + (parseInt(post.comments_count) || 0),
      url: post.url,
    });

    await upsertMention(mention);
    count++;
  }
  return count;
}

async function ingestComplaints(source: string): Promise<number> {
  const content = safeReadFile("complaints_history.csv");
  if (!content) return 0;

  const rows = parseCSV<any>(content);
  let count = 0;

  for (const row of rows) {
    if (!row.complaint_text) continue;
    const id = `complaint-${row.id || Math.random().toString(36).slice(2)}`;

    const mention = processText(id, source, "complaints", row.complaint_text.toString(), {
      timestamp: new Date(row.date || Date.now()),
      engagement: 0,
      isSimulated: false,
    });

    if (row.product) mention.product = normalizeProductName(row.product.toString());
    if (row.issue_type) {
      mention.topIssue = row.issue_type;
      mention.issueLabels = JSON.stringify([{ issue: row.issue_type, confidence: 0.95 }]);
    }

    await upsertMention(mention);
    count++;
  }
  return count;
}

// ── Competitor simulation ──────────────────────────────────────────────────────

const COMPETITOR_SENTIMENTS = [0.4, 0.25, 0.15, -0.1, -0.2, 0.3];
const COMPETITOR_ISSUES = ["product_quality", "delivery", "packaging", "pricing", "support"] as const;
const COMPETITOR_CHANNELS = ["amazon", "nykaa", "google", "twitter"] as const;

async function ingestCompetitors(): Promise<number> {
  const content = safeReadFile("competitors.csv");
  if (!content) return 0;

  const competitors = parseCSV<{ name: string; brand: string }>(content);
  let count = 0;

  for (const comp of competitors) {
    // Generate 10 synthetic mentions per competitor
    for (let i = 0; i < 10; i++) {
      const channel = COMPETITOR_CHANNELS[i % COMPETITOR_CHANNELS.length];
      const daysAgo = Math.floor(Math.random() * 14);
      const timestamp = new Date(Date.now() - daysAgo * 86400000);
      const sentimentScore = COMPETITOR_SENTIMENTS[i % COMPETITOR_SENTIMENTS.length];
      const issueType = COMPETITOR_ISSUES[i % COMPETITOR_ISSUES.length];

      const id = `comp-${comp.brand.toLowerCase().replace(/\s/g, "-")}-${i}`;

      await prisma.mention.upsert({
        where: { id },
        update: {},
        create: {
          id,
          source: comp.name,
          channel,
          timestamp,
          language: "en",
          text: `Synthetic mention for ${comp.name} — ${issueType} — ${sentimentScore > 0 ? "positive" : "negative"} sentiment`,
          sentimentScore,
          sentimentLabel: sentimentScore > 0.15 ? "pos" : sentimentScore < -0.15 ? "neg" : "neutral",
          topIssue: issueType,
          issueLabels: JSON.stringify([{ issue: issueType, confidence: 0.8 }]),
          credibilityScore: 50,
          engagement: Math.floor(Math.random() * 100),
          isSimulated: true,
          blastRadius: "contained",
          entities: "{}",
        },
      });
      count++;
    }

    // Upsert competitor record
    await prisma.competitor.upsert({
      where: { name: comp.name },
      update: {},
      create: { name: comp.name, brand: comp.brand },
    });
  }
  return count;
}

// ── Products ──────────────────────────────────────────────────────────────────

async function ingestProducts(): Promise<void> {
  const content = safeReadFile("products.csv");
  if (!content) return;

  const rows = parseCSV<{ name: string; sku: string; brand: string; category: string }>(content);
  for (const row of rows) {
    await prisma.product.upsert({
      where: { sku: row.sku },
      update: { name: row.name, brand: row.brand, category: row.category },
      create: { name: row.name, sku: row.sku, brand: row.brand, category: row.category },
    });
  }
}

// ── Hourly Aggregation ────────────────────────────────────────────────────────

async function buildHourlyAggregates(): Promise<void> {
  const mentions = await prisma.mention.findMany({
    select: {
      id: true,
      source: true,
      channel: true,
      timestamp: true,
      topIssue: true,
      product: true,
      sentimentScore: true,
      sentimentLabel: true,
      engagement: true,
    },
  });

  const aggs = new Map<string, {
    hour: string; source: string; product: string; channel: string; issue: string;
    count: number; negCount: number; totalSentiment: number; totalEngagement: number;
  }>();

  for (const m of mentions) {
    const hourDate = new Date(m.timestamp);
    hourDate.setMinutes(0, 0, 0);
    const hour = hourDate.toISOString();
    const product = m.product || "unknown";
    const issue = m.topIssue || "unknown";
    const key = `${hour}__${m.source}__${product}__${m.channel}__${issue}`;

    if (!aggs.has(key)) {
      aggs.set(key, { hour, source: m.source, product, channel: m.channel, issue, count: 0, negCount: 0, totalSentiment: 0, totalEngagement: 0 });
    }
    const agg = aggs.get(key)!;
    agg.count++;
    if (m.sentimentLabel === "neg") agg.negCount++;
    agg.totalSentiment += m.sentimentScore;
    agg.totalEngagement += m.engagement;
  }

  for (const agg of Array.from(aggs.values())) {
    await prisma.hourlyAggregate.upsert({
      where: { hour_source_product_channel_issue: { hour: agg.hour, source: agg.source, product: agg.product, channel: agg.channel, issue: agg.issue } },
      update: { count: agg.count, negCount: agg.negCount, avgSentiment: agg.totalSentiment / agg.count, totalEngagement: agg.totalEngagement },
      create: { hour: agg.hour, source: agg.source, product: agg.product, channel: agg.channel, issue: agg.issue, count: agg.count, negCount: agg.negCount, avgSentiment: agg.totalSentiment / agg.count, totalEngagement: agg.totalEngagement },
    });
  }
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertMention(m: NormalizedMention): Promise<void> {
  await prisma.mention.upsert({
    where: { id: m.id },
    update: {
      timestamp: m.timestamp,
      text: m.text,
      authorHandle: m.authorHandle,
      rating: m.rating,
      engagement: m.engagement,
      url: m.url,
      source: m.source,
      channel: m.channel,
      sentimentScore: m.sentimentScore,
      sentimentLabel: m.sentimentLabel,
      issueLabels: m.issueLabels,
      topIssue: m.topIssue,
      credibilityScore: m.credibilityScore,
      entities: m.entities,
      blastRadius: m.blastRadius,
      hasSarcasm: m.hasSarcasm,
      language: m.language,
      product: m.product,
      orderId: m.orderId,
      deliveryPartner: m.deliveryPartner,
      location: m.location,
    },
    create: {
      id: m.id,
      source: m.source,
      channel: m.channel,
      authorHandle: m.authorHandle,
      timestamp: m.timestamp,
      language: m.language,
      text: m.text,
      product: m.product,
      orderId: m.orderId,
      deliveryPartner: m.deliveryPartner,
      location: m.location,
      rating: m.rating,
      engagement: m.engagement,
      url: m.url,
      sentimentScore: m.sentimentScore,
      sentimentLabel: m.sentimentLabel,
      issueLabels: m.issueLabels,
      topIssue: m.topIssue,
      credibilityScore: m.credibilityScore,
      entities: m.entities,
      isSimulated: m.isSimulated,
      blastRadius: m.blastRadius,
      hasSarcasm: m.hasSarcasm,
    },
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface IngestionResult {
  total: number;
  byChannel: Record<string, number>;
  errors: string[];
  durationMs: number;
}

export async function runIngestion(source = "MosaicWellness"): Promise<IngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const byChannel: Record<string, number> = {};

  await ingestProducts();

  try { byChannel.amazon = await ingestAmazon(source); } catch (e: any) { errors.push(`amazon: ${e.message}`); byChannel.amazon = 0; }
  try { byChannel.nykaa = await ingestNykaa(source); } catch (e: any) { errors.push(`nykaa: ${e.message}`); byChannel.nykaa = 0; }
  try { byChannel.google = await ingestGoogle(source); } catch (e: any) { errors.push(`google: ${e.message}`); byChannel.google = 0; }
  try { byChannel.reddit = await ingestReddit(source); } catch (e: any) { errors.push(`reddit: ${e.message}`); byChannel.reddit = 0; }
  try { byChannel.twitter = await ingestTwitter(source); } catch (e: any) { errors.push(`twitter: ${e.message}`); byChannel.twitter = 0; }
  try { byChannel.instagram = await ingestInstagram(source); } catch (e: any) { errors.push(`instagram: ${e.message}`); byChannel.instagram = 0; }
  try { byChannel.complaints = await ingestComplaints(source); } catch (e: any) { errors.push(`complaints: ${e.message}`); byChannel.complaints = 0; }
  try { byChannel.competitors = await ingestCompetitors(); } catch (e: any) { errors.push(`competitors: ${e.message}`); byChannel.competitors = 0; }

  await buildHourlyAggregates();

  const total = Object.values(byChannel).reduce((s: number, v: number) => s + v, 0);
  return { total, byChannel, errors, durationMs: Date.now() - start };
}
