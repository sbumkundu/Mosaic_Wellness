"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface IncidentData {
  alert: {
    id: string;
    type: string;
    product?: string;
    channel?: string;
    issue?: string;
    magnitude: number;
    confidence: number;
    blastRadius: string;
    since: string;
    status: string;
    summary?: string;
  };
  mentions: Array<{
    id: string;
    channel: string;
    timestamp: string;
    text: string;
    sentimentLabel: string;
    sentimentScore: number;
    topIssue?: string;
    engagement: number;
    credibilityScore: number;
    blastRadius: string;
    hasSarcasm: boolean;
    location?: string;
    deliveryPartner?: string;
    authorHandle?: string;
    issueLabels: Array<{ issue: string; confidence: number }>;
  }>;
  clusters: Array<{
    id: string;
    title: string;
    mentionIds: string[];
    products: string[];
    topIssue: string;
    firstSeen: string;
    growthRate: number;
  }>;
  timeline: Array<{
    hour: string;
    count: number;
    negCount: number;
    avgSentiment: number;
  }>;
  locations: Array<{ name: string; count: number }>;
  deliveryPartners: Array<{ name: string; count: number }>;
  playbook: {
    title: string;
    urgency: string;
    suggestedResponse: string;
    internalActions: string[];
    owner: string;
    slaHours: number;
  } | null;
  totalMentions: number;
}

const URGENCY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-900/30 border-red-700/60",
  high: "text-orange-400 bg-orange-900/30 border-orange-700/60",
  medium: "text-yellow-400 bg-yellow-900/30 border-yellow-700/60",
  low: "text-green-400 bg-green-900/30 border-green-700/60",
};

const CHANNEL_ICONS: Record<string, string> = {
  amazon: "📦", nykaa: "💄", google: "⭐", reddit: "🔴",
  twitter: "🐦", instagram: "📸", complaints: "📋",
};

const BLAST_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high_risk: { label: "Critical", color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800/60" },
  watch: { label: "Watch", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-700/50" },
  contained: { label: "Contained", color: "text-green-400", bg: "bg-green-900/20", border: "border-green-800/40" },
};

const TABS = [
  { key: "timeline", label: "Timeline", icon: "📈" },
  { key: "mentions", label: "Mentions", icon: "💬" },
  { key: "clusters", label: "Clusters", icon: "🔗" },
  { key: "playbook", label: "Playbook", icon: "📋" },
] as const;

export default function IncidentRoom({ params }: { params: { id: string } }) {
  const [data, setData] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "mentions" | "clusters" | "playbook">("timeline");
  const [status, setStatus] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/incident/${params.id}`);
        if (!res.ok) throw new Error("Not found");
        const d = await res.json();
        setData(d);
        setStatus(d.alert.status);
      } catch {
        setData(null);
      }
      setLoading(false);
    };
    fetch_();
  }, [params.id]);

  const updateStatus = async (newStatus: string) => {
    await fetch(`/api/incident/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Incident Room…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center gap-3">
        <div className="text-3xl">🔍</div>
        <p className="text-gray-400 font-medium">Incident not found</p>
        <button onClick={() => router.push("/")} className="nav-btn mt-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const blast = BLAST_LABEL[data.alert.blastRadius] || BLAST_LABEL.contained;

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-[#0d1117] sticky top-0 z-30">
        <button onClick={() => router.push("/")} className="nav-btn">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-lg">⚠</span>
          <h1 className="font-semibold text-white text-sm">Incident Room</h1>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${blast.bg} ${blast.border} ${blast.color}`}>
            {blast.label}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-gray-500">Status</label>
          <select
            value={status}
            onChange={(e) => updateStatus(e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-gray-600 transition-colors"
          >
            <option value="active">🔴 Active</option>
            <option value="resolved">🟢 Resolved</option>
            <option value="dismissed">⚪ Dismissed</option>
          </select>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full">
        {/* Alert summary */}
        <div className={`rounded-xl border p-4 mb-4 ${blast.bg} ${blast.border}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-sm font-bold ${blast.color}`}>
                  {data.alert.type.replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {data.alert.magnitude.toFixed(1)}× magnitude · {Math.round(data.alert.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-3 leading-relaxed">{data.alert.summary}</p>
              <div className="flex gap-1.5 flex-wrap text-[11px]">
                {data.alert.channel && (
                  <span className="px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    📡 {data.alert.channel}
                  </span>
                )}
                {data.alert.issue && (
                  <span className="px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    🏷 {data.alert.issue.replace(/_/g, " ")}
                  </span>
                )}
                {data.alert.product && (
                  <span className="px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    📦 {data.alert.product}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 border border-gray-700/40">
                  Since {new Date(data.alert.since).toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-gray-800/80 text-gray-400 border border-gray-700/40">
                  {data.totalMentions} related mentions
                </span>
              </div>
            </div>

            {/* Quick stats */}
            {(data.locations.length > 0 || data.deliveryPartners.length > 0) && (
              <div className="grid grid-cols-2 gap-2 text-center shrink-0">
                {data.locations.slice(0, 2).map(l => (
                  <div key={l.name} className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/30">
                    <div className="text-sm font-bold text-white">{l.count}</div>
                    <div className="text-[10px] text-gray-500">{l.name}</div>
                  </div>
                ))}
                {data.deliveryPartners.slice(0, 2).map(p => (
                  <div key={p.name} className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/30">
                    <div className="text-sm font-bold text-white">{p.count}</div>
                    <div className="text-[10px] text-gray-500">{p.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mb-4 border-b border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "tab-active"
                  : "tab-inactive"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.key === "mentions" && (
                <span className="text-[10px] text-gray-600 ml-0.5">({data.totalMentions})</span>
              )}
              {tab.key === "clusters" && (
                <span className="text-[10px] text-gray-600 ml-0.5">({data.clusters.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="panel p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-1">Mention Volume Over Time</h3>
              <p className="text-xs text-gray-500 mb-3">Total vs. negative mentions per hour</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.timeline.map(t => ({
                  ...t,
                  hour: new Date(t.hour).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit" }),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={false} name="Total" />
                  <Line type="monotone" dataKey="negCount" stroke="#ef4444" strokeWidth={2} dot={false} name="Negative" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {data.locations.length > 0 && (
                <div className="panel p-4">
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">Top Locations</h3>
                  <div className="space-y-2">
                    {data.locations.slice(0, 6).map(l => (
                      <div key={l.name} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-24 truncate">{l.name}</span>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(l.count / data.locations[0].count) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right">{l.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.deliveryPartners.length > 0 && (
                <div className="panel p-4">
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">Delivery Partners Mentioned</h3>
                  <div className="space-y-2">
                    {data.deliveryPartners.map(p => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-24 truncate">{p.name}</span>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(p.count / data.deliveryPartners[0].count) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "mentions" && (
          <div className="space-y-2">
            {data.mentions.map(m => (
              <div key={m.id} className={`panel p-3 ${m.blastRadius === "high_risk" ? "border-red-900/60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">{CHANNEL_ICONS[m.channel] || "📢"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
                      <span className="text-gray-300 font-medium capitalize">{m.channel}</span>
                      {m.authorHandle && <span className="text-gray-500">@{m.authorHandle}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        m.sentimentLabel === "neg" ? "badge-neg" : m.sentimentLabel === "pos" ? "badge-pos" : "badge-neutral"
                      }`}>
                        {m.sentimentLabel === "neg" ? "Negative" : m.sentimentLabel === "pos" ? "Positive" : "Neutral"}
                      </span>
                      {m.topIssue && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-300 text-[10px]">
                          {m.topIssue.replace(/_/g, " ")}
                        </span>
                      )}
                      {m.hasSarcasm && (
                        <span className="px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400 text-[10px] border border-yellow-800/40"
                          title="Sarcasm detected — sentiment may be misleading">
                          ⚠ Sarcasm
                        </span>
                      )}
                      {m.engagement > 0 && <span className="text-gray-500 text-[10px]">👍 {m.engagement}</span>}
                      <span className="ml-auto text-gray-600 text-[10px]">{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{m.text}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                      {m.location && <span>📍 {m.location}</span>}
                      {m.deliveryPartner && <span>🚚 {m.deliveryPartner}</span>}
                      <span title="How trustworthy this source is (0–100)">Credibility: {m.credibilityScore}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "clusters" && (
          <div className="space-y-3">
            {data.clusters.length === 0 && (
              <div className="panel p-10 text-center">
                <div className="text-2xl mb-2">🔗</div>
                <p className="text-gray-500 text-sm">Not enough similar mentions to form narrative clusters yet</p>
              </div>
            )}
            {data.clusters.map((cluster, i) => (
              <div key={cluster.id} className="panel p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[11px] text-gray-500 mr-2">Story #{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-200">{cluster.title}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 text-right shrink-0 ml-3">
                    <div>{cluster.mentionIds.length} mentions</div>
                    <div>{cluster.growthRate.toFixed(1)}/day growth</div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/40">
                    🏷 {cluster.topIssue.replace(/_/g, " ")}
                  </span>
                  {cluster.products.map(p => (
                    <span key={p} className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/40">📦 {p}</span>
                  ))}
                  <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/40">
                    First seen {new Date(cluster.firstSeen).toLocaleDateString()}
                  </span>
                  {cluster.growthRate > 5 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40 font-medium">
                      ↑ Fast growing
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "playbook" && (
          <div>
            {!data.playbook && (
              <div className="panel p-10 text-center">
                <div className="text-2xl mb-2">📋</div>
                <p className="text-gray-500 text-sm">No playbook available for this issue type</p>
              </div>
            )}
            {data.playbook && (
              <div className={`panel p-5 border ${URGENCY_COLORS[data.playbook.urgency] || "border-gray-700"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-200 text-sm">{data.playbook.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] shrink-0 ml-3">
                    <span className={`px-2 py-0.5 rounded-lg border font-semibold ${URGENCY_COLORS[data.playbook.urgency]}`}>
                      {data.playbook.urgency.toUpperCase()}
                    </span>
                    <span className="text-gray-500">SLA: {data.playbook.slaHours}h</span>
                    <span className="text-gray-500">Owner: {data.playbook.owner}</span>
                  </div>
                </div>

                <div className="mb-5">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Suggested Public Response</p>
                  <div className="bg-gray-800/60 rounded-xl p-4 text-sm text-gray-300 italic border border-gray-700/40 leading-relaxed">
                    {data.playbook.suggestedResponse}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2.5">Internal Action Checklist</p>
                  <div className="space-y-2.5">
                    {data.playbook.internalActions.map((action, i) => (
                      <label key={i} className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" className="mt-0.5 rounded accent-cyan-500" />
                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">{action}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
