// Auto-triage playbooks for each issue type

export interface Playbook {
  issue: string;
  title: string;
  urgency: "critical" | "high" | "medium" | "low";
  suggestedResponse: string;
  internalActions: string[];
  owner: string;
  slaHours: number;
}

const PLAYBOOKS: Record<string, Playbook> = {
  delivery: {
    issue: "delivery",
    title: "Delivery Failure Response",
    urgency: "high",
    suggestedResponse: "Hi [Name], we sincerely apologize for the delivery issue with your order [ORDER_ID]. We've escalated this to our logistics partner and will ensure resolution within 24 hours. We're also issuing a [refund/replacement] as a goodwill gesture.",
    internalActions: [
      "Pull tracking data from logistics partner API for affected orders",
      "Check if delivery partner SLA was breached (>5 days = breach)",
      "Audit delivery hub for the customer's PIN code",
      "Flag to logistics partner with batch complaint reference",
      "Issue proactive refund if order > 7 days late",
      "Escalate to logistics partner account manager if 5+ complaints",
      "Update CX dashboard with resolution status",
    ],
    owner: "Logistics Ops",
    slaHours: 24,
  },
  packaging: {
    issue: "packaging",
    title: "Damaged Packaging Response",
    urgency: "medium",
    suggestedResponse: "Hi [Name], we're sorry your order arrived in damaged condition. Please share a photo of the packaging and we'll dispatch a replacement immediately. Your feedback helps us improve our packaging standards.",
    internalActions: [
      "Request photo evidence from customer",
      "Initiate replacement order without requiring return",
      "Flag to warehouse: check packing procedure for this product batch",
      "Review if damage is from packaging material quality vs handling",
      "Raise NC (non-conformance) ticket with warehouse ops if >3 reports",
      "Consider packaging upgrade for fragile SKUs",
    ],
    owner: "Warehouse Ops",
    slaHours: 48,
  },
  product_quality: {
    issue: "product_quality",
    title: "Product Quality Escalation",
    urgency: "high",
    suggestedResponse: "Hi [Name], thank you for bringing this to our attention. Product quality is our top priority. We'd like to understand your experience better — please share the batch number (on the packaging) and we'll investigate immediately.",
    internalActions: [
      "Collect batch number from customer",
      "Pull QA records for the batch",
      "Request third-party lab analysis if multiple reports for same batch",
      "Escalate to QA team lead within 2 hours",
      "Review if batch needs to be recalled",
      "Check supplier certificate of analysis (CoA)",
      "Issue replacement + apology gift",
    ],
    owner: "Quality Assurance",
    slaHours: 12,
  },
  side_effects: {
    issue: "side_effects",
    title: "Adverse Reaction / Side Effects Protocol",
    urgency: "critical",
    suggestedResponse: "Hi [Name], your health and safety is our absolute priority. We're very sorry to hear about your experience. Please discontinue use immediately and consult a doctor if needed. Share your batch number so we can investigate urgently. We'll cover any medical consultation costs.",
    internalActions: [
      "IMMEDIATE: Flag to Medical/Safety team",
      "Collect: batch number, date of purchase, usage duration, symptoms",
      "Issue safety hold on mentioned batch pending investigation",
      "Engage dermatologist consultant for review",
      "File adverse event report if required by CDSCO regulations",
      "Prepare medical disclaimer statement for public communications",
      "Legal team review if batch recall is necessary",
      "Issue full refund + medical consultation reimbursement",
      "DO NOT dismiss or minimize customer's experience in response",
    ],
    owner: "Medical Safety + Legal",
    slaHours: 4,
  },
  trust_authenticity: {
    issue: "trust_authenticity",
    title: "Counterfeit / Authenticity Crisis",
    urgency: "critical",
    suggestedResponse: "Hi [Name], we take authenticity concerns extremely seriously. All our products carry a unique QR code for verification. Please scan the QR on your product at [verification URL]. If it shows invalid, you likely received a counterfeit — we'll send you a genuine replacement and will report the seller.",
    internalActions: [
      "Identify the seller/channel where fake was purchased",
      "Report to marketplace (Amazon/Nykaa) seller team with evidence",
      "File IP complaint if pattern continues",
      "Push out authenticity checker blog/post proactively",
      "Enable QR verification on all future batches",
      "Legal: prepare cease and desist if needed",
      "PR team: prepare statement in case this goes viral",
      "Monitor social media for spread of authenticity concerns",
    ],
    owner: "Legal + Brand Protection",
    slaHours: 6,
  },
  pricing: {
    issue: "pricing",
    title: "Pricing Complaint Response",
    urgency: "low",
    suggestedResponse: "Hi [Name], we understand your concern about pricing. We're committed to providing the best value for quality wellness products. Here's a 15% discount code for your next order: [CODE]. We'd love for you to give us another chance.",
    internalActions: [
      "Check if customer bought at full price during a sale period",
      "Offer loyalty discount code",
      "Review if product price point is competitive",
      "Flag pricing feedback to Product/Business team monthly",
    ],
    owner: "CX Team",
    slaHours: 72,
  },
  support: {
    issue: "support",
    title: "Customer Support Failure Recovery",
    urgency: "medium",
    suggestedResponse: "Hi [Name], we sincerely apologize for the poor support experience. This is not the standard we hold ourselves to. I'm escalating your issue to a senior agent who will contact you within 2 hours with a resolution.",
    internalActions: [
      "Pull support ticket history",
      "Escalate to senior agent / team lead",
      "Identify which agent handled the case and provide coaching",
      "Resolve underlying issue first, then address support failure",
      "Send follow-up survey after resolution",
      "Flag recurring support failure patterns to Training team",
    ],
    owner: "CX Manager",
    slaHours: 4,
  },
};

export function getPlaybook(issue: string): Playbook | null {
  return PLAYBOOKS[issue] || null;
}

export function getAllPlaybooks(): Playbook[] {
  return Object.values(PLAYBOOKS);
}
