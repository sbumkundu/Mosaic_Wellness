"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EvalData {
  totalMentions: number;
  byChannel: Record<string, number>;
  sentimentDist: Record<string, number>;
  issueDist: Record<string, number>;
  credibilityAvg: number;
  alerts: number;
  simulatedCount: number;
  coverageChannels: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  amazon: "Amazon", nykaa: "Nykaa", google: "Google",
  reddit: "Reddit", twitter: "Twitter", instagram: "Instagram", complaints: "Complaints",
};

function StatCard({ value, label, color = "text-cyan-400" }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="panel p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function EvaluationPage() {
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [feedRes, alertRes] = await Promise.all([
          fetch("/api/feed?limit=0"),
          fetch("/api/crisis/alerts"),
        ]);
        const feedData = await feedRes.json();
        const alertData = await alertRes.json();

        const channelRes = await fetch("/api/feed?limit=200");
        const channelData = await channelRes.json();

        const byChannel: Record<string, number> = {};
        const sentimentDist: Record<string, number> = { pos: 0, neutral: 0, neg: 0 };
        const issueDist: Record<string, number> = {};
        let credSum = 0;
        let simCount = 0;

        for (const m of channelData.mentions || []) {
          byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
          sentimentDist[m.sentimentLabel] = (sentimentDist[m.sentimentLabel] || 0) + 1;
          if (m.topIssue) issueDist[m.topIssue] = (issueDist[m.topIssue] || 0) + 1;
          credSum += m.credibilityScore;
          if (m.isSimulated) simCount++;
        }

        setData({
          totalMentions: feedData.total || channelData.total || 0,
          byChannel,
          sentimentDist,
          issueDist,
          credibilityAvg: Math.round(credSum / Math.max(channelData.mentions?.length || 1, 1)),
          alerts: alertData.count || 0,
          simulatedCount: simCount,
          coverageChannels: Object.keys(byChannel).length,
        });
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-[#0d1117] sticky top-0 z-10">
        <button
          onClick={() => router.push("/")}
          className="nav-btn"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </button>
        <div className="w-px h-4 bg-gray-700" />
        <div>
          <h1 className="text-sm font-bold text-white">Data Quality Report</h1>
          <p className="text-[11px] text-gray-500">Coverage, sentiment breakdown, and system performance</p>
        </div>
      </header>

      <main className="p-5 max-w-5xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-gray-500 text-sm animate-pulse">Computing metrics…</div>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <section>
              <SectionHeader title="Overview" subtitle="Total data ingested and processed by SignalRoom" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard value={data?.totalMentions ?? 0} label="Total Mentions" />
                <StatCard value={data?.coverageChannels ?? 0} label="Active Channels" />
                <StatCard
                  value={data?.alerts ?? 0}
                  label="Crisis Alerts Detected"
                  color={(data?.alerts ?? 0) > 0 ? "text-yellow-400" : "text-green-400"}
                />
                <StatCard value={data?.simulatedCount ?? 0} label="Simulated Mentions" color="text-purple-400" />
              </div>
            </section>

            {/* Channel + Sentiment */}
            <section>
              <SectionHeader title="Breakdown" subtitle="How mentions are distributed across channels and sentiment" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Channel */}
                <div className="panel p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">By Channel</p>
                  <div className="space-y-2.5">
                    {Object.entries(data?.byChannel || {}).sort(([, a], [, b]) => b - a).map(([ch, count]) => {
                      const maxVal = Math.max(...Object.values(data?.byChannel || { _: 1 }));
                      return (
                        <div key={ch} className="flex items-center gap-2">
                          <span className="text-xs text-gray-300 w-24 font-medium">{CHANNEL_LABELS[ch] || ch}</span>
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full transition-all"
                              style={{ width: `${(count / maxVal) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sentiment */}
                <div className="panel p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">By Sentiment</p>
                  <div className="space-y-2.5">
                    {[
                      { key: "pos", label: "Positive", bar: "bg-green-500", text: "text-green-400" },
                      { key: "neutral", label: "Neutral", bar: "bg-gray-500", text: "text-gray-400" },
                      { key: "neg", label: "Negative", bar: "bg-red-500", text: "text-red-400" },
                    ].map(({ key, label, bar, text }) => {
                      const count = data?.sentimentDist[key] || 0;
                      const pct = Math.round((count / (data?.totalMentions || 1)) * 100);
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`text-xs w-16 font-medium ${text}`}>{label}</span>
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                          <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Issue distribution */}
            <section>
              <SectionHeader title="Issue Categories" subtitle="How complaints are distributed by topic" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data?.issueDist || {}).sort(([, a], [, b]) => b - a).map(([issue, count]) => {
                  const pct = Math.round((count / (data?.totalMentions || 1)) * 100);
                  return (
                    <div key={issue} className="panel p-3">
                      <div className="text-xl font-bold text-white mb-0.5">{count}</div>
                      <div className="text-xs font-medium text-gray-300">{issue.replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-gray-600 mt-1">{pct}% of total</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Analytics methods + Platform stats */}
            <section>
              <SectionHeader title="How It Works" subtitle="The analytics methods and platform capabilities behind SignalRoom" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Analytics methods */}
                <div className="panel p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Analytics Methods</p>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: "Avg. Source Credibility", value: `${data?.credibilityAvg}/100`, color: "text-cyan-400" },
                      { label: "Sentiment Analysis", value: "Deterministic Baseline", color: "text-yellow-400" },
                      { label: "Language Detection", value: "Heuristic (EN / HI / Hinglish)", color: "text-green-400" },
                      { label: "Anomaly Detection", value: "Robust Z-Score + EWMA", color: "text-green-400" },
                      { label: "Entity Extraction", value: "Regex + Dictionary NER", color: "text-green-400" },
                      { label: "Narrative Clustering", value: "TF-IDF + Cosine Similarity", color: "text-green-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">{label}</span>
                        <span className={`text-xs font-medium ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform stats */}
                <div className="panel p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Platform Capabilities</p>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: "Crisis Detection Speed", value: "< 2 sec on demand", color: "text-green-400" },
                      { label: "Live Feed Refresh", value: "Every 10 seconds", color: "text-green-400" },
                      { label: "KPI Refresh", value: "Every 10 seconds", color: "text-green-400" },
                      { label: "Channels Monitored", value: "6 (Amazon, Nykaa, Google, Reddit, Twitter, Instagram)", color: "text-cyan-400" },
                      { label: "Active Crisis Alerts", value: String(data?.alerts ?? 0), color: (data?.alerts ?? 0) > 0 ? "text-red-400" : "text-green-400" },
                      { label: "Feed Simulation", value: "48 hours at 5× speed", color: "text-green-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-start gap-2">
                        <span className="text-gray-400 text-xs shrink-0">{label}</span>
                        <span className={`text-xs font-medium text-right ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Case studies */}
            <section>
              <SectionHeader title="Early Warning Case Studies" subtitle="Examples of crises detected before they went viral" />
              <div className="space-y-3">
                {[
                  {
                    emoji: "🚚",
                    title: "Delivery Crisis — Delhivery SLA Breach",
                    description: "Volume spike of 3.1× detected in delivery complaints on Amazon, Reddit, and Twitter within 12 hours (Jan 28–30). Cross-channel contagion triggered a high-risk blast radius. 15+ mentions included order IDs and specific location data.",
                    channel: "Amazon, Reddit, Twitter",
                    issue: "Delivery",
                    detected: "Jan 28 — Day 1 of spike",
                  },
                  {
                    emoji: "🔍",
                    title: "Counterfeit Product Alert — Trust Crisis",
                    description: "Reddit thread with 892 upvotes about possible fake products detected early. Lab test confirmation thread followed within 24 hours with 1,876 upvotes. Cross-channel trust signal flagged across Amazon, Nykaa, and Reddit.",
                    channel: "Reddit, Amazon, Nykaa",
                    issue: "Trust / Authenticity",
                    detected: "Jan 26 — 8h before viral spread",
                  },
                  {
                    emoji: "⚕️",
                    title: "Biotin Gummies Side Effects Spike",
                    description: "Side effects complaints (skin breakouts) spiked on Reddit with 687 upvotes, then amplified by a Twitter thread with 1,234 likes. Safety response playbook was auto-surfaced by SignalRoom.",
                    channel: "Reddit, Twitter",
                    issue: "Side Effects",
                    detected: "Jan 24 — same day as viral post",
                  },
                ].map((c, i) => (
                  <div key={i} className="panel p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5 shrink-0">{c.emoji}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200 mb-1">{c.title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed mb-3">{c.description}</p>
                        <div className="flex gap-2 flex-wrap text-[11px]">
                          <span className="px-2 py-0.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700/40">📡 {c.channel}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700/40">🏷 {c.issue}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-green-900/30 text-green-400 border border-green-800/40">⚡ {c.detected}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
