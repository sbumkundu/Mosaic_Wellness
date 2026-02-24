"use client";
import { useEffect, useState } from "react";

interface KPIData {
  healthScore: number;
  avgSentiment: number;
  negVolume: number;
  negRatio: number;
  totalMentions: number;
  volumeChange: number;
  activeAlerts: number;
  topIssues: Array<{ issue: string; count: number; pct: number }>;
  channelBreakdown: Array<{ channel: string; count: number }>;
  languages: Array<{ lang: string; count: number }>;
}

const ISSUE_LABELS: Record<string, string> = {
  product_quality: "Quality",
  delivery: "Delivery",
  packaging: "Packaging",
  pricing: "Pricing",
  support: "Support",
  side_effects: "Side Effects",
  trust_authenticity: "Trust",
};


function Divider() {
  return <div className="w-px self-stretch bg-gray-800 mx-1" />;
}

export default function KPIStrip({ onRefresh }: { onRefresh?: () => void }) {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchKPIs = async () => {
    try {
      const res = await fetch("/api/kpis?hours=24");
      const data = await res.json();
      setKpis(data);
      setLastUpdated(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="panel p-4 flex items-center gap-6 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 w-24 bg-gray-800 rounded" />
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const topLang = kpis.languages.sort((a, b) => b.count - a.count).slice(0, 2);
  const sentimentPts = Math.round(kpis.avgSentiment * 100);
  const sentimentColor = kpis.avgSentiment > 0.1 ? "text-green-400" : kpis.avgSentiment < -0.1 ? "text-red-400" : "text-gray-300";

  return (
    <div className="panel px-4 py-3 flex items-center gap-5 overflow-x-auto">
      {/* Total Mentions */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Total Mentions</span>
        <span className="text-xl font-bold text-white mt-0.5">{kpis.totalMentions.toLocaleString()}</span>
        <span className={`text-[11px] mt-0.5 ${kpis.volumeChange > 0 ? "text-red-400" : "text-green-400"}`}>
          {kpis.volumeChange > 0 ? "▲" : "▼"} {Math.abs(kpis.volumeChange)}% vs yesterday
        </span>
      </div>

      {/* Negative Mentions */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Negative</span>
        <span className="text-xl font-bold text-red-400 mt-0.5">{kpis.negVolume}</span>
        <span className="text-[11px] text-gray-500 mt-0.5">{kpis.negRatio}% of total</span>
      </div>

      <Divider />

      {/* Active Alerts */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Active Alerts</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xl font-bold ${kpis.activeAlerts > 0 ? "text-red-400" : "text-green-400"}`}>
            {kpis.activeAlerts}
          </span>
          {kpis.activeAlerts > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-500 mt-0.5">{kpis.activeAlerts === 0 ? "all clear" : "need attention"}</span>
      </div>

      {/* Top Issue */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Top Issue</span>
        <span className="text-sm font-semibold text-yellow-400 mt-0.5">
          {kpis.topIssues[0] ? ISSUE_LABELS[kpis.topIssues[0].issue] || kpis.topIssues[0].issue : "—"}
        </span>
        <span className="text-[11px] text-gray-500 mt-0.5">
          {kpis.topIssues[0] ? `${kpis.topIssues[0].pct}% of negatives` : "no data"}
        </span>
      </div>

      <Divider />

      {/* Languages */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Languages</span>
        <div className="flex gap-1.5 mt-1">
          {topLang.map(l => (
            <span key={l.lang} className="px-2 py-0.5 rounded-md text-[11px] bg-gray-800 text-cyan-400 border border-gray-700 font-medium">
              {l.lang.toUpperCase()} · {l.count}
            </span>
          ))}
        </div>
      </div>

      {/* Sentiment */}
      <div className="flex flex-col min-w-max">
        <span className="metric-label">Avg Sentiment</span>
        <span className={`text-xl font-bold mt-0.5 ${sentimentColor}`}>
          {sentimentPts > 0 ? "+" : ""}{sentimentPts}
        </span>
        <span className="text-[11px] text-gray-500 mt-0.5">
          {sentimentPts > 10 ? "mostly positive" : sentimentPts < -10 ? "mostly negative" : "mixed"}
        </span>
      </div>

      {/* Refresh */}
      <div className="ml-auto flex items-center gap-2 min-w-max">
        <span className="text-[11px] text-gray-600">
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <button
          onClick={() => { fetchKPIs(); onRefresh?.(); }}
          className="nav-btn text-[11px] px-2 py-1"
          title="Refresh KPIs now"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round"/>
            <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
