import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import responsePolicy from "@/lib/responses/responsePolicy.json";

type Taxonomy = keyof typeof responsePolicy.requiredElementsByTaxonomy;
type BrandVoice = keyof typeof responsePolicy.brandVoiceGuidelines;

function buildResponseText(
  taxonomy: Taxonomy,
  channel: string,
  brandVoice: BrandVoice,
  incidentSummary: string | null,
): string {
  const policy = responsePolicy;
  const voiceGuide = policy.brandVoiceGuidelines[brandVoice] || policy.brandVoiceGuidelines.professional;
  const starters = voiceGuide.startWith;
  const starter = starters[Math.floor(Math.random() * starters.length)];

  const playbookTemplates: Record<string, string> = {
    delivery:
      `${starter} We sincerely apologize for the delay with your order. Our team has escalated this to our logistics partner and we will ensure resolution within 24 hours. Please DM your order ID so we can prioritize your case. ${policy.escalationInstructions.default}`,
    packaging:
      `${starter} We're sorry your order arrived in poor condition. Please send us a photo of the packaging so we can dispatch a replacement immediately — no return required. ${policy.escalationInstructions.default}`,
    product_quality:
      `${starter} Product quality is our highest priority. Please share the batch number printed on your packaging so our quality team can investigate immediately. We will make this right. ${policy.disclaimers.product_quality}`,
    side_effects:
      `${starter} Your safety is our absolute priority. Please discontinue use immediately and consult a doctor if needed. Share your batch number via DM so our medical safety team can investigate urgently. ${policy.disclaimers.side_effects} ${policy.escalationInstructions.side_effects}`,
    trust_authenticity:
      `${starter} We take authenticity concerns extremely seriously. ${policy.disclaimers.trust_authenticity} ${policy.escalationInstructions.trust_authenticity}`,
    pricing:
      `${starter} We understand your concern about pricing. We strive to offer the best value for high-quality wellness products. Please DM us for a special discount on your next order as a gesture of goodwill.`,
    support:
      `${starter} This is not the standard we hold ourselves to. I'm escalating your issue to a senior team member who will contact you within 2 hours. ${policy.escalationInstructions.default}`,
  };

  // Channel-specific length constraints
  const text = playbookTemplates[taxonomy] || `${starter} Thank you for your feedback. Please DM us your order details so we can resolve this immediately. ${policy.escalationInstructions.default}`;
  if (channel === "twitter") return text.slice(0, 270); // leave room for handles
  return text;
}

function buildChecklist(taxonomy: Taxonomy, brandVoice: BrandVoice): Array<{ item: string; required: boolean; done: boolean }> {
  const policy = responsePolicy;
  const elements = policy.requiredElementsByTaxonomy[taxonomy] || { required: [], optional: [] };

  const checkItems: Array<{ item: string; required: boolean; done: boolean }> = [
    ...elements.required.map((r: string) => ({ item: r.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), required: true, done: false })),
    ...elements.optional.map((r: string) => ({ item: r.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), required: false, done: false })),
    { item: "Spell-checked and reviewed before posting", required: true, done: false },
    { item: "No forbidden phrases used", required: true, done: false },
    { item: "Brand voice is " + brandVoice, required: true, done: false },
    { item: "Request moved to DM for PII collection", required: true, done: false },
  ];
  return checkItems;
}

function detectRedFlags(responseText: string): Array<{ flag: string; reason: string }> {
  const flags: Array<{ flag: string; reason: string }> = [];
  const policy = responsePolicy;

  for (const phrase of policy.forbiddenPhrases) {
    if (responseText.toLowerCase().includes(phrase.toLowerCase())) {
      flags.push({ flag: phrase, reason: "Forbidden phrase detected — may escalate customer anger" });
    }
  }

  if (responseText.length > 500 && responseText.includes("twitter")) {
    flags.push({ flag: "response_too_long", reason: "Twitter responses should be ≤280 characters" });
  }
  if (!responseText.toLowerCase().includes("dm") && !responseText.toLowerCase().includes("message")) {
    flags.push({ flag: "missing_dm_cta", reason: "Response should redirect to DM to avoid public PII sharing" });
  }

  return flags;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const incidentId = params.id;

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const channel: string = body.channel || incident.primaryChannel || "twitter";
  const taxonomy: Taxonomy = (body.taxonomy || incident.summary?.match(/(\w+_?\w+)/)?.[1] || "support") as Taxonomy;
  const brandVoice: BrandVoice = (body.brandVoice || "professional") as BrandVoice;

  const responseText = buildResponseText(taxonomy, channel, brandVoice, incident.summary);
  const checklist = buildChecklist(taxonomy, brandVoice);
  const redFlags = detectRedFlags(responseText);

  // Persist
  const saved = await prisma.incidentSuggestedResponse.create({
    data: {
      incidentId,
      channel,
      taxonomy,
      brandVoice,
      responseText,
      checklistJson: JSON.stringify(checklist),
      redFlagsJson: JSON.stringify(redFlags),
    },
  });

  return NextResponse.json({
    id: saved.id,
    incidentId,
    channel,
    taxonomy,
    brandVoice,
    responseText,
    checklist,
    redFlags,
    createdAt: saved.createdAt,
  });
}

// GET: fetch all previously generated responses for an incident
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const responses = await prisma.incidentSuggestedResponse.findMany({
    where: { incidentId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    responses: responses.map(r => ({
      ...r,
      checklist: JSON.parse(r.checklistJson),
      redFlags: JSON.parse(r.redFlagsJson),
    })),
  });
}
