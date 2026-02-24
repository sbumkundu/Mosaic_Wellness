"use client";
import { useEffect, useState } from "react";

interface Brief {
  healthScore: number;
  trend: string;
  avgSentiment: number;
  topIssue: string;
  topIssuePct: number;
  activeAlerts: number;
  sentences: string[];
  actions: string[];
  generatedAt: string;
  date: string;
  cached: boolean;
}

export default function DailyBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/brief/today");
        const data = await res.json();
        setBrief(data);
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, []);

  const downloadBrief = () => {
    if (!brief) return;
    const text = [
      `SIGNALROOM DAILY BRIEF — ${brief.date}`,
      `Brand Health Score: ${brief.healthScore}/100 (${brief.trend})`,
      "",
      ...brief.sentences.map((s, i) => `${i + 1}. ${s}`),
      "",
      "RECOMMENDED ACTIONS:",
      ...brief.actions.map((a, i) => `${i + 1}. ${a}`),
      "",
      `Generated at: ${brief.generatedAt}`,
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signalroom-brief-${brief.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="panel p-4 animate-pulse space-y-3">
        <div className="h-4 w-36 bg-gray-800 rounded" />
        <div className="h-14 bg-gray-800 rounded-lg" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-3 bg-gray-800 rounded" />)}
      </div>
    );
  }

  if (!brief) return null;

  const trendColor = brief.trend === "improving" ? "text-green-400" : brief.trend === "declining" ? "text-red-400" : "text-yellow-400";
  const trendIcon = brief.trend === "improving" ? "↑" : brief.trend === "declining" ? "↓" : "→";
  const healthColor = brief.healthScore >= 70 ? "#10b981" : brief.healthScore >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <div className="panel p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="panel-title">AI Daily Brief</h2>
            {brief.cached && (
              <span className="text-[10px] text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-700/30">
                Cached
              </span>
            )}
          </div>
          <p className="panel-subtitle">Auto-generated summary for {brief.date}</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowFull(v => !v)}
            className="nav-btn"
          >
            {showFull ? (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Collapse
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Read More
              </>
            )}
          </button>
          <button
            onClick={downloadBrief}
            className="nav-btn"
            title="Download this brief as a .txt file"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Score card */}
      <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/60 border border-gray-700/40 mb-3">
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 shrink-0"
          style={{ borderColor: healthColor }}>
          <span className="text-lg font-bold leading-none" style={{ color: healthColor }}>{brief.healthScore}</span>
          <span className="text-[9px] text-gray-500 mt-0.5">/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${trendColor}`}>{trendIcon} {brief.trend.charAt(0).toUpperCase() + brief.trend.slice(1)}</div>
          <div className="text-[11px] text-gray-500">Brand health trend</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-yellow-300">{brief.topIssue.replace(/_/g, " ")}</div>
          <div className="text-[11px] text-gray-500">{brief.topIssuePct}% of issues</div>
        </div>
      </div>

      {/* Brief sentences */}
      <div className="space-y-2">
        {(showFull ? brief.sentences : brief.sentences.slice(0, 3)).map((sentence, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-cyan-500 font-bold shrink-0 w-4">{i + 1}.</span>
            <p className="text-gray-300 leading-relaxed">{sentence}</p>
          </div>
        ))}
        {!showFull && brief.sentences.length > 3 && (
          <button
            onClick={() => setShowFull(true)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 ml-6 underline underline-offset-2"
          >
            +{brief.sentences.length - 3} more insights…
          </button>
        )}
      </div>

      {/* Recommended actions (only when expanded) */}
      {showFull && brief.actions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/60">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Recommended Actions</p>
          <div className="space-y-1.5">
            {brief.actions.map((action, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-orange-400 shrink-0 mt-0.5">→</span>
                <p className="text-gray-300">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
