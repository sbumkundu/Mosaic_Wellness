"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Alert {
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
  representativeMentions?: Array<{ id: string; text: string; channel: string; engagement: number }>;
}

const BLAST_CONFIG: Record<string, {
  borderClass: string;
  bgClass: string;
  badgeClass: string;
  dot: string;
  label: string;
  sublabel: string;
}> = {
  high_risk: {
    borderClass: "border-red-800/70",
    bgClass: "bg-red-950/40",
    badgeClass: "bg-red-900/60 text-red-300 border border-red-700/60",
    dot: "bg-red-500",
    label: "Critical",
    sublabel: "Immediate action needed",
  },
  watch: {
    borderClass: "border-yellow-700/60",
    bgClass: "bg-yellow-950/30",
    badgeClass: "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50",
    dot: "bg-yellow-400",
    label: "Watch",
    sublabel: "Monitor closely",
  },
  contained: {
    borderClass: "border-green-800/40",
    bgClass: "bg-green-950/20",
    badgeClass: "bg-green-900/40 text-green-300 border border-green-700/40",
    dot: "bg-green-500",
    label: "Contained",
    sublabel: "Low risk",
  },
};

const TYPE_LABELS: Record<string, string> = {
  volume_spike: "Volume Spike",
  cross_channel: "Cross-Channel",
  high_reach: "High Reach",
  sentiment_drop: "Sentiment Drop",
  early_warning: "Predictive Signal",
};

export default function CrisisRadar({ onAlertSelect }: { onAlertSelect?: (id: string) => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchAlerts = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const url = refresh ? "/api/crisis/alerts?refresh=true" : "/api/crisis/alerts";
      const res = await fetch(url);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(), 30000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/incident/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const criticalCount = alerts.filter(a => a.blastRadius === "high_risk").length;
  const activeAlerts = alerts.filter(a => a.type !== "early_warning");
  const earlyWarnings = alerts.filter(a => a.type === "early_warning");

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${alerts.length > 0 ? "bg-red-400" : "bg-green-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${alerts.length > 0 ? "bg-red-500" : "bg-green-500"}`} />
            </span>
            <h2 className="panel-title">Crisis Radar</h2>
            {alerts.length > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800/60 font-medium">
                {alerts.length} active
              </span>
            )}
          </div>
          <p className="panel-subtitle mt-1">
            {criticalCount > 0
              ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} — click any card to investigate`
              : "AI-detected anomalies from live mention data"}
          </p>
        </div>
        <button
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
          className="nav-btn shrink-0"
          title="Re-run anomaly detection on latest data"
        >
          {refreshing ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round"/>
              <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {refreshing ? "Scanning…" : "Scan Now"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-green-900/40 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-300 mb-1">No active alerts</p>
            <p className="text-xs text-gray-500 mb-3">Everything looks normal right now</p>
            <button
              onClick={() => fetchAlerts(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              Run a fresh scan
            </button>
          </div>
        )}

        {/* Predictive Signals — early warnings before threshold */}
        {!loading && earlyWarnings.length > 0 && (
          <div className="mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80 px-1 mb-1.5 flex items-center gap-1.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 19h20L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
              </svg>
              Predictive Signals · 24-48h outlook
            </p>
            {earlyWarnings.map(alert => {
              const etaMatch = alert.summary?.match(/est\. (\d+)h to spike/);
              const etaHours = etaMatch ? parseInt(etaMatch[1]) : null;
              return (
                <div
                  key={alert.id}
                  onClick={() => { onAlertSelect?.(alert.id); router.push(`/incidents/${alert.id}`); }}
                  className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 cursor-pointer hover:brightness-110 transition-all mb-2"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Predictive
                      </span>
                      {alert.issue && (
                        <span className="text-[11px] text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-700/50">
                          {alert.issue.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {etaHours && (
                      <span className="text-[11px] font-mono text-amber-400 shrink-0">
                        ~{etaHours}h
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed mb-1.5">
                    {alert.summary}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>{alert.channel && `📡 ${alert.channel}`}</span>
                    <span className="text-amber-400/70">{Math.round(alert.confidence * 100)}% confidence · Open Incident Room →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active alerts section label */}
        {!loading && activeAlerts.length > 0 && earlyWarnings.length > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/80 px-1 mb-1.5">
            Active Alerts
          </p>
        )}

        {activeAlerts.map(alert => {
          const cfg = BLAST_CONFIG[alert.blastRadius] || BLAST_CONFIG.contained;
          const since = new Date(alert.since).toLocaleString("en-IN", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });

          return (
            <div
              key={alert.id}
              onClick={() => { onAlertSelect?.(alert.id); router.push(`/incidents/${alert.id}`); }}
              className={`rounded-xl border p-3 cursor-pointer transition-all hover:brightness-110 ${cfg.bgClass} ${cfg.borderClass}`}
            >
              {/* Alert header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-700/50">
                    {TYPE_LABELS[alert.type] || alert.type}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-gray-400 font-mono" title="How much larger than normal volume">
                    {Math.round(alert.magnitude * 10) / 10}×
                  </span>
                  <button
                    onClick={(e) => dismiss(alert.id, e)}
                    className="text-gray-600 hover:text-gray-400 transition-colors text-sm leading-none ml-1"
                    title="Dismiss this alert"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-gray-300 mb-2.5 leading-relaxed">
                {alert.summary || `${alert.type} detected`}
              </p>

              {/* Meta pills */}
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                {alert.channel && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    📡 {alert.channel}
                  </span>
                )}
                {alert.issue && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    🏷 {alert.issue.replace(/_/g, " ")}
                  </span>
                )}
                {alert.product && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40">
                    📦 {alert.product}
                  </span>
                )}
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700/40">
                  {Math.round(alert.confidence * 100)}% confidence
                </span>
              </div>

              {/* Top signal quote */}
              {alert.representativeMentions && alert.representativeMentions.length > 0 && (
                <div className="border-t border-gray-700/40 pt-2 mb-2">
                  <p className="text-[11px] text-gray-500 mb-1">Top signal:</p>
                  <p className="text-xs text-gray-400 italic line-clamp-2">
                    "{alert.representativeMentions[0].text}"
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Since {since}</span>
                <span className="text-cyan-400 font-medium hover:text-cyan-300 flex items-center gap-1">
                  Open Incident Room
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
