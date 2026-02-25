"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const CHANNEL_ICONS: Record<string, string> = {
  amazon: "📦", nykaa: "💄", google: "⭐", reddit: "🔴",
  twitter: "🐦", instagram: "📸", complaints: "📋",
};

const CHANNEL_LABELS: Record<string, string> = {
  amazon: "Amazon", nykaa: "Nykaa", google: "Google",
  reddit: "Reddit", twitter: "Twitter", instagram: "Instagram", complaints: "Complaints",
};

const CHANNEL_COLORS: Record<string, string> = {
  amazon: "text-yellow-400", nykaa: "text-pink-400", google: "text-blue-400",
  reddit: "text-orange-400", twitter: "text-cyan-400", instagram: "text-purple-400",
  complaints: "text-red-400",
};

const ISSUE_COLORS: Record<string, string> = {
  delivery: "bg-orange-500/20 text-orange-300",
  product_quality: "bg-red-500/20 text-red-300",
  packaging: "bg-yellow-500/20 text-yellow-300",
  side_effects: "bg-pink-500/20 text-pink-300",
  trust_authenticity: "bg-purple-500/20 text-purple-300",
  pricing: "bg-blue-500/20 text-blue-300",
  support: "bg-gray-500/20 text-gray-300",
};

interface Mention {
  id: string;
  channel: string;
  authorHandle?: string;
  timestamp: string;
  text: string;
  product?: string;
  sentimentLabel: string;
  sentimentScore: number;
  topIssue?: string;
  credibilityScore: number;
  engagement: number;
  blastRadius: string;
  hasSarcasm: boolean;
  isSimulated: boolean;
  rating?: number;
  location?: string;
}

function SentimentBadge({ label }: { label: string; score: number }) {
  const cls = label === "neg" ? "badge-neg" : label === "pos" ? "badge-pos" : "badge-neutral";
  const text = label === "neg" ? "Negative" : label === "pos" ? "Positive" : "Neutral";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {text}
    </span>
  );
}

function CredibilityBar({ score }: { score: number }) {
  const color = score > 70 ? "bg-green-500" : score > 40 ? "bg-yellow-500" : "bg-red-500";
  const label = score > 70 ? "High" : score > 40 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-1" title={`Source credibility: ${label} (${score}/100)`}>
      <div className="w-10 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-gray-600">{score}</span>
    </div>
  );
}

export default function LiveFeed({ onSelectMention }: { onSelectMention?: (id: string) => void }) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    channel: "", issue: "", sentiment: "", language: "", product: "",
  });
  const router = useRouter();

  const fetchFeed = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "30");
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    try {
      const res = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      setMentions(data.mentions || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const setFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: prev[key as keyof typeof prev] === value ? "" : value }));
  };

  const markReviewed = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMentions(prev => prev.filter(m => m.id !== id));
  };

  const channels = ["amazon", "nykaa", "google", "reddit", "twitter", "instagram"];
  const sentiments = [
    { value: "neg", label: "Negative", activeClass: "active-red" },
    { value: "neutral", label: "Neutral", activeClass: "active-gray" },
    { value: "pos", label: "Positive", activeClass: "active-green" },
  ];

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center justify-between mb-1">
          <h2 className="panel-title">Live Feed</h2>
          <span className="text-[11px] text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-full border border-gray-700/40">
            {total.toLocaleString()} total
          </span>
        </div>
        <p className="panel-subtitle mb-2">Latest brand mentions across all channels</p>

        {/* Channel filters */}
        <div className="flex gap-1 flex-wrap mb-1.5">
          {channels.map(ch => (
            <button
              key={ch}
              onClick={() => setFilter("channel", ch)}
              className={`filter-pill ${filters.channel === ch ? "active-cyan" : ""}`}
              title={`Filter by ${CHANNEL_LABELS[ch]}`}
            >
              {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
            </button>
          ))}
        </div>

        {/* Sentiment filters */}
        <div className="flex gap-1 flex-wrap">
          {sentiments.map(s => (
            <button
              key={s.value}
              onClick={() => setFilter("sentiment", s.value)}
              className={`filter-pill ${filters.sentiment === s.value ? s.activeClass : ""}`}
            >
              {s.label}
            </button>
          ))}
          {(filters.channel || filters.sentiment) && (
            <button
              onClick={() => setFilters({ channel: "", issue: "", sentiment: "", language: "", product: "" })}
              className="filter-pill text-gray-600 hover:text-gray-400"
            >
              × Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/70">
        {loading && (
          <div className="p-6 text-center">
            <div className="text-gray-500 text-sm">Loading mentions…</div>
          </div>
        )}
        {!loading && mentions.length === 0 && (
          <div className="p-6 text-center">
            <div className="text-gray-500 text-sm mb-2">No mentions found</div>
            <button
              onClick={() => fetch("/api/ingest", { method: "POST" })}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              Load data first
            </button>
          </div>
        )}
        {mentions.map(m => (
          <div
            key={m.id}
            className="p-3 hover:bg-gray-800/40 cursor-pointer transition-colors group"
            onClick={() => onSelectMention?.(m.id)}
          >
            <div className="flex items-start gap-2.5">
              {/* Channel icon */}
              <span className="text-base mt-0.5 shrink-0">{CHANNEL_ICONS[m.channel] || "📢"}</span>

              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`text-xs font-semibold ${CHANNEL_COLORS[m.channel] || "text-gray-400"}`}>
                    {CHANNEL_LABELS[m.channel] || m.channel}
                  </span>
                  {m.authorHandle && (
                    <span className="text-[11px] text-gray-600">@{m.authorHandle}</span>
                  )}
                  {m.product && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-400 border border-gray-600/30">
                      {m.product}
                    </span>
                  )}
                  {m.isSimulated && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-800/50"
                      title="This is a simulated mention (not real user data)"
                    >
                      Simulated
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                    {new Date(m.timestamp).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Text */}
                <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                  {m.text}
                </p>

                {/* Footer tags */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <SentimentBadge label={m.sentimentLabel} score={m.sentimentScore} />

                  {m.topIssue && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ISSUE_COLORS[m.topIssue] || "bg-gray-700 text-gray-300"}`}>
                      {m.topIssue.replace(/_/g, " ")}
                    </span>
                  )}

                  {m.hasSarcasm && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800/40"
                      title="Sarcasm detected — sentiment may be misleading"
                    >
                      ⚠ Sarcasm
                    </span>
                  )}

                  {m.blastRadius !== "contained" && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      m.blastRadius === "high_risk"
                        ? "bg-red-900/40 text-red-400 border border-red-800/40"
                        : "bg-yellow-900/40 text-yellow-400 border border-yellow-800/40"
                    }`}>
                      {m.blastRadius === "high_risk" ? "🔴 High Risk" : "🟡 Watch"}
                    </span>
                  )}

                  {m.engagement > 0 && (
                    <span className="text-[10px] text-gray-500" title="Engagement count (likes/upvotes)">
                      👍 {m.engagement}
                    </span>
                  )}

                  <div className="ml-auto" title={`Source credibility score: ${m.credibilityScore}/100`}>
                    <CredibilityBar score={m.credibilityScore} />
                  </div>
                </div>

                {/* Hover micro-actions */}
                <div className="hidden group-hover:flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-800/60">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push("/incidents"); }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    title="Go to incidents to link this mention"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Add to Incident
                  </button>
                  <span className="text-gray-700">·</span>
                  <button
                    onClick={(e) => markReviewed(m.id, e)}
                    className="text-[10px] text-gray-500 hover:text-green-400 flex items-center gap-1 transition-colors"
                    title="Mark as reviewed and remove from feed"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Mark Reviewed
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
