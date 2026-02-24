"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  Target, Search, LineChart as LineChartIcon, MessageSquare, Eye,
  Shield, Share2, TrendingUp, MapPin, Truck, BarChart2,
  Copy, Check, RefreshCw, Wand2, AlertTriangle, Clock,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ChartCaption } from "@/components/ui/ChartCaption";
import { SkeletonBlock } from "@/components/ui/Skeleton";

// ── Types ─────────────────────────────────────────────────────────────
interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  brandId: string;
  primaryChannel: string | null;
  productId: string | null;
  summary: string | null;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  clusters: Array<{
    id: string; clusterKey: string; size: number; summary: string;
    topTerms: string[]; topEntities: string[]; deltaVsBaseline: number;
    examples: string[];
  }>;
  blastRadius: {
    impactScore: number;
    etaToCrossChannelHours: number | null;
    expectedReach24h: number | null;
    expectedReach48h: number | null;
    propagationPath: string[];
    reasonCodes: string[];
  } | null;
  narrativeRisk: {
    riskScore: number; riskLevel: string;
    topTriggers: Array<{ name: string; count: number }>;
    examples: string[];
  } | null;
  simulations: Array<{
    id: string; actionType: string; confidence: number;
    series: Array<{ hour: number; volume: number; negShare: number; trustIndex: number; narrativeRisk: number }>;
  }>;
  suggestedResponses: Array<{
    id: string; channel: string; taxonomy: string; brandVoice: string;
    responseText: string;
    checklist: Array<{ item: string; required: boolean; done: boolean }>;
    redFlags: Array<{ flag: string; reason: string }>;
    createdAt: string;
  }>;
}

interface FullData {
  incident: Incident;
  attribution: {
    locations: Array<{ name: string; count: number; pct: number }>;
    deliveryPartners: Array<{ name: string; count: number; pct: number }>;
    channels: Array<{ name: string; count: number; pct: number }>;
  };
  timeline: Array<{ hour: string; count: number; negCount: number; avgSentiment: number }>;
  healthTrend: Array<{ date: string; trustIndex: number; narrativeRiskIndex: number }>;
  opportunities: Array<{
    id: string; summary: string; recommendedAction: string; evidence: string[];
    competitorId: string;
  }>;
  competitorIncidents: Array<{
    id: string; competitorId: string; summary: string;
    topIssues: Array<{ issue: string; count: number }>; riskScore: number;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  do_nothing: "#6b7280",
  refunds: "#06b6d4",
  public_statement: "#8b5cf6",
  recall: "#ef4444",
  partner_switch: "#f59e0b",
  support_sla_change: "#10b981",
};

const ACTION_LABELS: Record<string, string> = {
  do_nothing: "Do Nothing",
  refunds: "Issue Refunds",
  public_statement: "Public Statement",
  recall: "Product Recall",
  partner_switch: "Switch Delivery Partner",
  support_sla_change: "Support SLA Change",
};

const CHANNEL_DISPLAY: Record<string, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  amazon: "Amazon",
  nykaa: "Nykaa",
  google: "Google Reviews",
  complaints: "Support Tickets",
};

const TAXONOMY_DISPLAY: Record<string, string> = {
  delivery: "Delivery",
  packaging: "Packaging",
  product_quality: "Product Quality",
  side_effects: "Side Effects",
  trust_authenticity: "Trust & Authenticity",
  pricing: "Pricing",
  support: "Customer Support",
};

const TT_STYLE = {
  contentStyle: { background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px", padding: "8px 12px" },
  labelStyle: { color: "#9ca3af", marginBottom: 4 },
};

const TABS = [
  { key: "overview",    label: "Overview",     icon: Target },
  { key: "rootcause",  label: "Root Causes",   icon: Search },
  { key: "simulator",  label: "Simulator",     icon: LineChartIcon },
  { key: "response",   label: "Response",      icon: MessageSquare },
  { key: "competitor", label: "Competitor Watch", icon: Eye },
] as const;

type TabKey = typeof TABS[number]["key"];

// ── Component ─────────────────────────────────────────────────────────
export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<FullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [simAction, setSimAction] = useState("do_nothing");
  const [genChannel, setGenChannel] = useState("twitter");
  const [genTaxonomy, setGenTaxonomy] = useState("delivery");
  const [genVoice, setGenVoice] = useState("professional");
  const [genLoading, setGenLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      setData(await res.json());
    } catch { setData(null); }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (status: string) => {
    setStatusUpdating(true);
    await fetch(`/api/incidents/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setStatusUpdating(false);
  };

  const generateResponse = async () => {
    setGenLoading(true);
    await fetch(`/api/incidents/${params.id}/suggest-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: genChannel, taxonomy: genTaxonomy, brandVoice: genVoice }),
    });
    await load();
    setGenLoading(false);
  };

  const copyResponse = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading / error states ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Incidents", href: "/incidents" }, { label: "Loading…" }]} />
        <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full space-y-4">
          <SkeletonBlock className="h-32 rounded-xl" />
          <SkeletonBlock className="h-10 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            <SkeletonBlock className="h-48 rounded-xl" />
            <SkeletonBlock className="h-48 rounded-xl" />
            <SkeletonBlock className="h-48 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Incidents", href: "/incidents" }, { label: "Not found" }]} />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Search className="w-6 h-6 text-gray-500" />}
            title="Incident not found"
            description="This incident may have been dismissed or the ID is incorrect."
            action={
              <button onClick={() => router.push("/incidents")} className="nav-btn">
                ← Back to Incidents
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const { incident, attribution, timeline, healthTrend, opportunities, competitorIncidents } = data;

  // Simulator data
  const doNothingSim = incident.simulations.find(s => s.actionType === "do_nothing");
  const activeSim = incident.simulations.find(s => s.actionType === simAction);
  const simChartData = (doNothingSim?.series || []).map((pt, i) => ({
    hour: `H${pt.hour}`,
    "Do Nothing": Math.round(pt.negShare * 100),
    [ACTION_LABELS[simAction] || simAction]: Math.round((activeSim?.series[i]?.negShare ?? pt.negShare) * 100),
    doNothingTrust: Math.round(pt.trustIndex),
    actionTrust: Math.round(activeSim?.series[i]?.trustIndex ?? pt.trustIndex),
  })).filter((_, i) => i % 4 === 0);

  const latestResponse = incident.suggestedResponses[0];

  const statusOptions = [
    { value: "active", label: "Active", color: "text-red-400" },
    { value: "investigating", label: "Investigating", color: "text-yellow-400" },
    { value: "resolved", label: "Resolved", color: "text-green-400" },
    { value: "dismissed", label: "Dismissed", color: "text-gray-400" },
  ];

  // Compute a trust trend caption
  const firstTrust = healthTrend[0]?.trustIndex;
  const lastTrust = healthTrend[healthTrend.length - 1]?.trustIndex;
  const trustDelta = firstTrust != null && lastTrust != null ? Math.round(lastTrust - firstTrust) : null;

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Incidents", href: "/incidents" },
          { label: incident.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 hidden sm:inline">Status</label>
            <select
              value={incident.status}
              onChange={e => updateStatus(e.target.value)}
              disabled={statusUpdating}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Update incident status"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {statusUpdating && <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />}
          </div>
        }
      />

      <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full">

        {/* ── Hero Decision Strip ────────────────────────────────────── */}
        <div className="panel p-4 mb-4 border-l-4 space-y-3" style={{
          borderLeftColor: incident.severity === "critical" ? "#ef4444" :
            incident.severity === "high" ? "#f97316" :
            incident.severity === "medium" ? "#f59e0b" : "#10b981"
        }}>
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5 flex-wrap min-w-0">
              <RiskBadge severity={incident.severity} />
              {incident.narrativeRisk && (
                <RiskBadge
                  severity={incident.narrativeRisk.riskLevel}
                  score={incident.narrativeRisk.riskScore}
                  tooltip={`PR Escalation Risk: ${incident.narrativeRisk.riskLevel} (${incident.narrativeRisk.riskScore}/100)`}
                />
              )}
              {incident.blastRadius && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold text-orange-400 bg-orange-900/20 border-orange-700/40">
                  <Share2 className="w-2.5 h-2.5" />
                  Spread Risk {incident.blastRadius.impactScore}/100
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
              <Clock className="w-3 h-3" />
              {new Date(incident.windowStart).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit" })}
              {" → "}
              {new Date(incident.windowEnd).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit" })}
            </div>
          </div>

          {/* Summary */}
          {incident.summary && (
            <p className="text-sm text-gray-300 leading-relaxed">{incident.summary}</p>
          )}

          {/* Meta chips */}
          <div className="flex gap-1.5 flex-wrap">
            {incident.primaryChannel && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40 capitalize">
                {incident.primaryChannel}
              </span>
            )}
            {incident.productId && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40">
                {incident.productId}
              </span>
            )}
          </div>

          {/* Quick action strip */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-800/60 flex-wrap">
            <span className="text-[11px] text-gray-500">Quick actions:</span>
            {incident.status === "active" && (
              <button onClick={() => updateStatus("investigating")} className="nav-btn text-[11px] py-1">
                Mark Investigating
              </button>
            )}
            {incident.status === "investigating" && (
              <button onClick={() => updateStatus("resolved")} className="nav-btn text-[11px] py-1">
                Mark Resolved
              </button>
            )}
            <button
              onClick={() => setActiveTab("response")}
              className="nav-btn text-[11px] py-1"
            >
              <MessageSquare className="w-3 h-3" /> Draft Response
            </button>
            <button
              onClick={() => setActiveTab("rootcause")}
              className="nav-btn text-[11px] py-1"
            >
              <Search className="w-3 h-3" /> View Root Causes
            </button>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-0.5 mb-4 border-b border-gray-800" role="tablist" aria-label="Incident sections">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:text-cyan-400 ${
                  activeTab === tab.key ? "tab-active" : "tab-inactive"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Spread Risk (formerly Blast Radius) */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-900/30 flex items-center justify-center">
                    <Share2 className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200">Spread Risk</h3>
                </div>
                {incident.blastRadius ? (
                  <>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-bold ${incident.blastRadius.impactScore >= 70 ? "text-red-400" : incident.blastRadius.impactScore >= 40 ? "text-orange-400" : "text-yellow-400"}`}>
                        {incident.blastRadius.impactScore}
                      </span>
                      <span className="text-gray-500 text-xs mb-1">/100 impact</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${incident.blastRadius.impactScore >= 70 ? "bg-red-500" : incident.blastRadius.impactScore >= 40 ? "bg-orange-500" : "bg-yellow-500"}`}
                        style={{ width: `${incident.blastRadius.impactScore}%` }}
                      />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {incident.blastRadius.etaToCrossChannelHours != null && (
                        <div className="flex justify-between text-gray-400">
                          <span>Cross-channel in</span>
                          <span className="text-orange-400 font-medium">{incident.blastRadius.etaToCrossChannelHours}h</span>
                        </div>
                      )}
                      {incident.blastRadius.expectedReach24h != null && (
                        <div className="flex justify-between text-gray-400">
                          <span>Reach at 24h</span>
                          <span className="text-white font-medium">{incident.blastRadius.expectedReach24h.toLocaleString()}</span>
                        </div>
                      )}
                      {incident.blastRadius.expectedReach48h != null && (
                        <div className="flex justify-between text-gray-400">
                          <span>Reach at 48h</span>
                          <span className="text-white font-medium">{incident.blastRadius.expectedReach48h.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {incident.blastRadius.propagationPath.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">Spread path</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {incident.blastRadius.propagationPath.map((ch, i) => (
                            <span key={ch} className="flex items-center gap-1">
                              {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-gray-600" />}
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400">{ch}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {incident.blastRadius.reasonCodes.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Why it's spreading</p>
                        <ul className="space-y-0.5">
                          {incident.blastRadius.reasonCodes.map(r => (
                            <li key={r} className="text-[11px] text-gray-400 flex gap-1">
                              <span className="text-orange-400 shrink-0">•</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={<Share2 className="w-5 h-5 text-gray-600" />}
                    title="No spread data yet"
                    description='Run "Detect Incidents" to compute spread risk.'
                  />
                )}
              </div>

              {/* PR Escalation Risk (formerly Narrative Risk) */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-900/30 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200">PR Escalation Risk</h3>
                </div>
                {incident.narrativeRisk ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`text-3xl font-bold ${incident.narrativeRisk.riskScore >= 50 ? "text-red-400" : incident.narrativeRisk.riskScore >= 20 ? "text-yellow-400" : "text-green-400"}`}>
                        {incident.narrativeRisk.riskScore}
                      </span>
                      <RiskBadge severity={incident.narrativeRisk.riskLevel} />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {incident.narrativeRisk.riskScore >= 50
                        ? "High risk of media amplification — act within hours."
                        : incident.narrativeRisk.riskScore >= 20
                        ? "Moderate risk — monitor closely for escalation signals."
                        : "Low escalation risk — standard monitoring recommended."}
                    </p>
                    {incident.narrativeRisk.topTriggers.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">Top escalation drivers</p>
                        <div className="space-y-1.5">
                          {incident.narrativeRisk.topTriggers.map(t => (
                            <div key={t.name} className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-400 w-36 truncate capitalize">{t.name.replace(/_/g, " ")}</span>
                              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, t.count * 15)}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500 tabular-nums">{t.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {incident.narrativeRisk.examples.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">Signal examples (redacted)</p>
                        {incident.narrativeRisk.examples.slice(0, 2).map((ex, i) => (
                          <div key={i} className="text-[11px] text-gray-400 bg-gray-800/50 rounded-lg p-2 mb-1.5 italic border border-gray-700/30 line-clamp-2">
                            &ldquo;{ex}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="w-5 h-5 text-gray-600" />}
                    title="No escalation data yet"
                    description='Run "Detect Incidents" to compute PR escalation risk.'
                  />
                )}
              </div>

              {/* Trust Index Trend */}
              <div className="panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-cyan-900/30 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200">Trust Index Trend</h3>
                </div>
                {healthTrend.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={healthTrend.slice(-14)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <Tooltip {...TT_STYLE} />
                        {lastTrust != null && lastTrust < 50 && (
                          <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Caution", position: "right", fontSize: 9, fill: "#f59e0b" }} />
                        )}
                        <Line type="monotone" dataKey="trustIndex" stroke="#06b6d4" strokeWidth={2} dot={false} name="Trust" />
                        <Line type="monotone" dataKey="narrativeRiskIndex" stroke="#ef4444" strokeWidth={1.5} dot={false} name="PR Risk" strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                    <ChartCaption
                      text={
                        trustDelta != null
                          ? `Trust ${trustDelta < 0 ? `dropped ${Math.abs(trustDelta)} points` : `gained ${trustDelta} points`} over 14 days. ${lastTrust != null && lastTrust < 50 ? "Currently below the caution threshold." : "Currently above the caution threshold."}`
                          : "14-day trust index vs PR escalation risk. Below 50 = caution zone."
                      }
                      highlight={lastTrust != null && lastTrust < 50 ? "Below caution" : undefined}
                    />
                  </>
                ) : (
                  <EmptyState
                    icon={<Shield className="w-5 h-5 text-gray-600" />}
                    title="No trend data"
                    description="Health trend data will appear after running incident detection."
                  />
                )}
              </div>
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="panel p-4">
                <SectionHeader
                  title="Mention Volume Over Time"
                  subtitle="Total vs negative mentions per hour during this incident window"
                />
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={timeline.map(t => ({
                    ...t,
                    hour: new Date(t.hour).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit" }),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <Tooltip {...TT_STYLE} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={false} name="Total mentions" />
                    <Line type="monotone" dataKey="negCount" stroke="#ef4444" strokeWidth={2} dot={false} name="Negative mentions" />
                  </LineChart>
                </ResponsiveContainer>
                <ChartCaption
                  text="A sharp rise in negative mentions relative to total volume is an early warning signal. Peaks indicate moments of maximum customer frustration."
                />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── ROOT CAUSES TAB ──────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "rootcause" && (
          <div className="space-y-4">
            {incident.clusters.length === 0 ? (
              <EmptyState
                icon={<Search className="w-6 h-6 text-gray-500" />}
                title="No root causes detected yet"
                description='Root cause clusters are automatically grouped from mention patterns. Run "Detect Incidents" to populate this section.'
                action={<button className="nav-btn">Detect Incidents</button>}
              />
            ) : (
              <>
                <SectionHeader
                  title="Root Causes"
                  subtitle={`${incident.clusters.length} distinct issue clusters identified within this incident`}
                />

                {/* Cluster cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {incident.clusters.slice(0, 3).map((cluster, i) => (
                    <div key={cluster.id} className="panel p-4 space-y-3 border-t-2" style={{
                      borderTopColor: i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#6b7280"
                    }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Driver {i + 1}</span>
                          <h4 className="text-sm font-semibold text-gray-200 mt-0.5 leading-snug">
                            {cluster.summary.split(":")[0]}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold ${cluster.deltaVsBaseline >= 3 ? "text-red-400" : "text-orange-400"}`}>
                            {cluster.deltaVsBaseline.toFixed(1)}×
                          </div>
                          <div className="text-[10px] text-gray-500">above normal</div>
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-gray-400 leading-relaxed">{cluster.summary}</p>

                      {/* Entities */}
                      {cluster.topEntities.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Key drivers</p>
                          <div className="flex flex-wrap gap-1">
                            {cluster.topEntities.slice(0, 5).map(e => (
                              <span key={e} className="text-[10px] px-1.5 py-0.5 bg-blue-900/20 rounded text-blue-400 border border-blue-800/30">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Top terms */}
                      {cluster.topTerms.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Common terms</p>
                          <div className="flex flex-wrap gap-1">
                            {cluster.topTerms.slice(0, 6).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700/40">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* What to do */}
                      <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Suggested next step</p>
                        <p className="text-[11px] text-gray-300">
                          {i === 0
                            ? "Prioritise this cluster — it's driving the most volume above baseline."
                            : i === 1
                            ? "Monitor closely — if volume grows, escalate to operations."
                            : "Watch for cross-cluster amplification patterns."}
                        </p>
                      </div>

                      {/* Examples */}
                      {cluster.examples.length > 0 && (
                        <details className="group">
                          <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                            Show examples ({cluster.examples.length})
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {cluster.examples.slice(0, 2).map((ex, j) => (
                              <div key={j} className="text-[11px] text-gray-400 bg-gray-800/40 rounded-lg p-2 italic border border-gray-700/20 line-clamp-2">
                                &ldquo;{ex}&rdquo;
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                {/* Attribution charts */}
                <SectionHeader
                  title="Drivers Breakdown"
                  subtitle="Where and who is driving the highest complaint volume"
                  className="mt-6"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "By Location", icon: MapPin, data: attribution.locations, color: "#06b6d4" },
                    { label: "By Delivery Partner", icon: Truck, data: attribution.deliveryPartners, color: "#f59e0b" },
                    { label: "By Channel", icon: BarChart2, data: attribution.channels, color: "#8b5cf6" },
                  ].map(({ label, icon: Icon, data: attrData, color }) =>
                    attrData.length > 0 ? (
                      <div key={label} className="panel p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="w-3.5 h-3.5 text-gray-400" />
                          <h4 className="text-sm font-semibold text-gray-200">{label}</h4>
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={attrData.slice(0, 6)} layout="vertical">
                            <XAxis type="number" tick={{ fontSize: 9, fill: "#6b7280" }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#6b7280" }} width={70} />
                            <Tooltip {...TT_STYLE} />
                            <Bar dataKey="count" fill={color} radius={[0, 3, 3, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <ChartCaption
                          text={`Top driver accounts for ${attrData[0]?.pct ?? "?"}% of mentions. Focus operational response here first.`}
                        />
                      </div>
                    ) : null
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── SIMULATOR TAB ────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "simulator" && (
          <div className="space-y-4">
            <SectionHeader
              title="What-If Simulator"
              subtitle="Compare how different response actions affect negative sentiment and trust recovery over 48 hours"
            />
            <div className="panel p-4">
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Response Action</label>
                  <select
                    value={simAction}
                    onChange={e => setSimAction(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    {incident.simulations.map(s => (
                      <option key={s.actionType} value={s.actionType}>{ACTION_LABELS[s.actionType] || s.actionType}</option>
                    ))}
                  </select>
                </div>
                {activeSim && (
                  <div className="bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2 text-xs">
                    Model confidence: <span className="text-cyan-400 font-semibold">{Math.round(activeSim.confidence * 100)}%</span>
                  </div>
                )}
              </div>

              {simChartData.length === 0 ? (
                <EmptyState
                  icon={<LineChartIcon className="w-5 h-5 text-gray-600" />}
                  title="No simulation data"
                  description='Run "Detect Incidents" to generate scenario simulations for this incident.'
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-2">Negative Rate % — 48h forecast</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={simChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <Tooltip {...TT_STYLE} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                        <Line type="monotone" dataKey="Do Nothing" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                        <Line type="monotone" dataKey={ACTION_LABELS[simAction] || simAction}
                          stroke={ACTION_COLORS[simAction] || "#06b6d4"} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    <ChartCaption
                      text={`Taking action (${ACTION_LABELS[simAction]}) vs doing nothing. A lower negative rate % means faster sentiment recovery.`}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-2">Trust Recovery — 48h forecast</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={simChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
                        <Tooltip {...TT_STYLE} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                        <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="doNothingTrust" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Do Nothing" />
                        <Line type="monotone" dataKey="actionTrust" stroke={ACTION_COLORS[simAction] || "#06b6d4"} strokeWidth={2} dot={false} name={ACTION_LABELS[simAction]} />
                      </LineChart>
                    </ResponsiveContainer>
                    <ChartCaption
                      text="Trust index recovery speed. Faster recovery = less long-term brand damage. Reference line at 50 = caution threshold."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── RESPONSE TAB ─────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "response" && (
          <div className="space-y-4">
            <SectionHeader
              title="Response Composer"
              subtitle="Generate a guardrailed, brand-voice-aligned response for each channel"
            />

            {/* Step-by-step composer */}
            <div className="panel p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                {/* Step 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="step-number active">1</span>
                    <label className="text-[11px] text-gray-400 font-medium">Channel</label>
                  </div>
                  <select value={genChannel} onChange={e => setGenChannel(e.target.value)}
                    className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500">
                    {Object.entries(CHANNEL_DISPLAY).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Step 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="step-number active">2</span>
                    <label className="text-[11px] text-gray-400 font-medium">Issue Type</label>
                  </div>
                  <select value={genTaxonomy} onChange={e => setGenTaxonomy(e.target.value)}
                    className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500">
                    {Object.entries(TAXONOMY_DISPLAY).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Step 3 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="step-number active">3</span>
                    <label className="text-[11px] text-gray-400 font-medium">Brand Voice</label>
                  </div>
                  <select value={genVoice} onChange={e => setGenVoice(e.target.value)}
                    className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500">
                    <option value="professional">Professional</option>
                    <option value="empathetic">Empathetic</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Step 4 — Generate */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="step-number active">4</span>
                    <label className="text-[11px] text-gray-400 font-medium">Generate</label>
                  </div>
                  <button
                    onClick={generateResponse}
                    disabled={genLoading}
                    className="btn-primary w-full justify-center"
                  >
                    {genLoading
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                      : <><Wand2 className="w-3 h-3" /> Generate</>}
                  </button>
                </div>
              </div>

              {/* Response context chips */}
              {latestResponse && (
                <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-4 pb-4 border-b border-gray-800">
                  <span>Latest for:</span>
                  <span className="px-2 py-0.5 bg-gray-800 border border-gray-700/40 rounded text-gray-300">{CHANNEL_DISPLAY[latestResponse.channel] ?? latestResponse.channel}</span>
                  <span className="px-2 py-0.5 bg-gray-800 border border-gray-700/40 rounded text-gray-300">{TAXONOMY_DISPLAY[latestResponse.taxonomy] ?? latestResponse.taxonomy.replace(/_/g, " ")}</span>
                  <span className="px-2 py-0.5 bg-gray-800 border border-gray-700/40 rounded text-gray-300 capitalize">{latestResponse.brandVoice}</span>
                </div>
              )}
            </div>

            {/* Generated response */}
            {latestResponse && (
              <div className="panel p-4 space-y-4">
                {/* Response text */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Response Text</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600">{latestResponse.responseText.length} chars</span>
                      <button
                        onClick={() => copyResponse(latestResponse.responseText)}
                        className="nav-btn text-[11px] py-1"
                        title="Copy response to clipboard"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-4 text-sm text-gray-200 border border-gray-700/40 leading-relaxed whitespace-pre-wrap">
                    {latestResponse.responseText}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Compliance checklist */}
                  <div>
                    <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2.5">Compliance Checklist</p>
                    <div className="space-y-2">
                      {latestResponse.checklist.map((item, i) => {
                        const key = `${latestResponse.id}-${i}`;
                        const checked = checkedItems.has(key);
                        return (
                          <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500"
                              checked={checked}
                              onChange={() => {
                                setCheckedItems(prev => {
                                  const next = new Set(prev);
                                  next.has(key) ? next.delete(key) : next.add(key);
                                  return next;
                                });
                              }}
                            />
                            <span className={`text-xs leading-relaxed ${item.required ? "text-gray-300" : "text-gray-500"} ${checked ? "line-through opacity-60" : ""}`}>
                              {item.item}
                              {item.required && <span className="text-red-400 ml-1 no-underline">*</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2">* = required before publishing</p>
                  </div>

                  {/* Red flags */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Red Flags</p>
                      {latestResponse.redFlags.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 border border-red-800/40 rounded-full">
                          {latestResponse.redFlags.length} found
                        </span>
                      )}
                    </div>
                    {latestResponse.redFlags.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/15 border border-green-800/30 rounded-lg p-3">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>No red flags detected — response is safe to use.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {latestResponse.redFlags.map((f, i) => (
                          <div key={i} className="bg-red-900/20 border border-red-800/40 rounded-lg p-2.5">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs text-red-400 font-medium">{f.flag}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{f.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!latestResponse && !genLoading && (
              <div className="panel">
                <EmptyState
                  icon={<MessageSquare className="w-6 h-6 text-gray-500" />}
                  title="No response generated yet"
                  description="Choose a channel, issue type, and brand voice above, then click Generate to create a guardrailed response."
                />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── COMPETITOR WATCH TAB ─────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "competitor" && (
          <div className="space-y-4">
            {competitorIncidents.length > 0 && (
              <>
                <SectionHeader
                  title="Competitor Incidents"
                  subtitle="Similar issues at competitor brands — useful context for benchmarking your response"
                />
                <div className="space-y-3">
                  {competitorIncidents.map(ci => (
                    <div key={ci.id} className="panel p-4">
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <p className="text-xs text-gray-300 leading-relaxed">{ci.summary}</p>
                        <span className={`text-sm font-bold shrink-0 ${ci.riskScore >= 50 ? "text-red-400" : "text-orange-400"}`}>
                          {ci.riskScore}/100
                        </span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {ci.topIssues.slice(0, 4).map(issue => (
                          <span key={issue.issue} className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700/40">
                            {issue.issue.replace(/_/g, " ")} ({issue.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {opportunities.length > 0 && (
              <>
                <SectionHeader
                  title="Opportunities for MosaicWellness"
                  subtitle="Actions you can take to gain advantage while competitors are struggling"
                  className="mt-6"
                />
                <div className="space-y-3">
                  {opportunities.map(opp => (
                    <div key={opp.id} className="panel p-4 border-l-2 border-green-600/60">
                      <p className="text-sm text-gray-200 mb-1.5">{opp.summary}</p>
                      <p className="text-xs text-green-400 font-medium mb-3 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" /> {opp.recommendedAction}
                      </p>
                      {opp.evidence.length > 0 && (
                        <details>
                          <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors list-none flex items-center gap-1">
                            <ChevronRight className="w-3 h-3" />
                            Supporting evidence ({opp.evidence.length})
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {opp.evidence.slice(0, 2).map((ev, i) => (
                              <div key={i} className="text-[11px] text-gray-500 italic bg-gray-800/40 rounded-lg p-2 border border-gray-700/20 line-clamp-2">
                                &ldquo;{ev}&rdquo;
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {competitorIncidents.length === 0 && opportunities.length === 0 && (
              <EmptyState
                icon={<Eye className="w-6 h-6 text-gray-500" />}
                title="No competitor intelligence yet"
                description='Competitor incidents and opportunities are populated when you run "Detect Incidents". This shows you how similar issues are playing out at other brands.'
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
