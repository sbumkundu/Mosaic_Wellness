"use client";
import { useState, useEffect } from "react";
import KPIStrip from "@/components/KPIStrip";
import LiveFeed from "@/components/LiveFeed";
import CrisisRadar from "@/components/CrisisRadar";
import IssueHeatmap from "@/components/IssueHeatmap";
import CompetitorPanel from "@/components/CompetitorPanel";
import DailyBrief from "@/components/DailyBrief";
import ReplayMode from "@/components/ReplayMode";
import TrustNarrativeWidget from "@/components/TrustNarrativeWidget";
import { useRouter } from "next/navigation";
import {
  Download, AlertTriangle, BarChart2, Play,
  Zap, TrendingDown, RefreshCw,
} from "lucide-react";

// ── Hero strip data ────────────────────────────────────────────────────
interface HeroData {
  healthScore: number;
  activeAlerts: number;
  topIncident: {
    id: string;
    title: string;
    severity: string;
    impactScore: number | null;
  } | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-green-400",
};

const HEALTH_CONFIG = (score: number) => {
  if (score >= 70) return { color: "#10b981", label: "Healthy", ring: "stroke-emerald-500" };
  if (score >= 45) return { color: "#f59e0b", label: "Caution", ring: "stroke-amber-500" };
  return { color: "#ef4444", label: "At Risk", ring: "stroke-red-500" };
};

function BrandHealthGauge({ score }: { score: number }) {
  const cfg = HEALTH_CONFIG(score);
  const circumference = 2 * Math.PI * 30;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="30" fill="none" stroke="#1f2937" strokeWidth="5" />
        <circle
          cx="40" cy="40" r="30" fill="none"
          stroke={cfg.color} strokeWidth="5"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none" style={{ color: cfg.color }}>{score}</span>
        <span className="text-[9px] text-gray-500 mt-0.5">/100</span>
      </div>
    </div>
  );
}

function HeroStrip({ heroData, loading }: { heroData: HeroData | null; loading: boolean }) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="panel p-5 grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-800/40 rounded-xl overflow-hidden animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[#111827] p-5 flex flex-col gap-3">
            <div className="h-2.5 w-20 bg-gray-800 rounded" />
            <div className="h-8 w-16 bg-gray-800 rounded" />
            <div className="h-2 w-32 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!heroData) return null;

  const healthCfg = HEALTH_CONFIG(heroData.healthScore);
  const inc = heroData.topIncident;
  const sevColor = inc ? (SEVERITY_COLORS[inc.severity] ?? "text-gray-400") : "text-gray-400";

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800">
      {/* Left — Brand Health */}
      <div className="bg-[#111827] p-5 flex items-center gap-4">
        <BrandHealthGauge score={heroData.healthScore} />
        <div>
          <p className="metric-label mb-1">Brand Health</p>
          <p className="text-xl font-bold" style={{ color: healthCfg.color }}>{healthCfg.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Score {heroData.healthScore}/100 · updated just now
          </p>
          {heroData.healthScore < 50 && (
            <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Below safe threshold
            </p>
          )}
        </div>
      </div>

      {/* Right — Highest Risk Incident */}
      <div className="bg-[#111827] p-5 flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-orange-900/20 border border-orange-800/40 flex items-center justify-center shrink-0">
          <Zap className="w-6 h-6 text-orange-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="metric-label mb-1">Highest Risk</p>
          {inc ? (
            <>
              <button
                onClick={() => router.push(`/incidents/${inc.id}`)}
                className="text-left group"
              >
                <p className="text-sm font-semibold text-gray-200 leading-snug group-hover:text-cyan-400 transition-colors line-clamp-2">
                  {inc.title}
                </p>
              </button>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase ${sevColor} px-1.5 py-0.5 rounded border ${
                  inc.severity === "critical" ? "bg-red-900/20 border-red-700/40" :
                  inc.severity === "high" ? "bg-orange-900/20 border-orange-700/40" :
                  "bg-yellow-900/20 border-yellow-700/30"
                }`}>
                  {inc.severity}
                </span>
                {inc.impactScore != null && (
                  <span className="text-[11px] text-gray-400">
                    Impact <span className={`font-semibold ${inc.impactScore >= 70 ? "text-red-400" : "text-orange-400"}`}>{inc.impactScore}</span>/100
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No active incidents</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const [replayOpen, setReplayOpen] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [heroData, setHeroData] = useState<HeroData | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const router = useRouter();

  const fetchHeroData = async () => {
    try {
      const [kpisRes, incRes] = await Promise.all([
        fetch("/api/kpis?hours=24"),
        fetch("/api/incidents?status=active&limit=1"),
      ]);
      const kpis = await kpisRes.json();
      const incidents = await incRes.json();
      const topInc = incidents.incidents?.[0] ?? null;
      setHeroData({
        healthScore: kpis.healthScore ?? 0,
        activeAlerts: kpis.activeAlerts ?? 0,
        topIncident: topInc
          ? {
              id: topInc.id,
              title: topInc.title,
              severity: topInc.severity,
              impactScore: topInc.impactScore,
            }
          : null,
      });
    } catch {
      // silently fail — sub-components have their own data
    }
    setHeroLoading(false);
  };

  useEffect(() => {
    fetchHeroData();
    const interval = setInterval(fetchHeroData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runIngest = async () => {
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const data = await res.json();
      setIngestResult(
        data.success
          ? `Loaded ${data.total} mentions in ${data.durationMs}ms`
          : data.error
      );
      await fetch("/api/crisis/alerts?refresh=true");
      fetchHeroData();
    } catch (e: unknown) {
      setIngestResult((e as Error).message);
    }
    setIngesting(false);
  };

  const ingestOk = ingestResult != null && !ingestResult.startsWith("✗") && !ingestResult.toLowerCase().includes("error");

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* ── Top navigation bar ──────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-[#0d1117] sticky top-0 z-30">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center font-bold text-black text-sm select-none">
              S
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-white tracking-tight text-sm">SignalRoom</span>
              <span className="text-gray-500 text-[10px] mt-0.5">MosaicWellness</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-800/60 px-2.5 py-1 rounded-full border border-gray-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
            Brand Crisis Radar · Live
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {ingestResult && (
            <span
              className={`text-xs px-3 py-1 rounded-lg font-medium max-w-[220px] truncate ${
                ingestOk
                  ? "text-green-300 bg-green-900/40 border border-green-800/60"
                  : "text-red-300 bg-red-900/40 border border-red-800/60"
              }`}
              title={ingestResult}
            >
              {ingestOk ? "✓" : "✗"} {ingestResult}
            </span>
          )}

          <button
            onClick={runIngest}
            disabled={ingesting}
            className="nav-btn"
            title="Load the latest brand mentions from all channels"
            aria-label="Load data"
          >
            {ingesting ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{ingesting ? "Loading…" : "Load Data"}</span>
          </button>

          <button
            onClick={() => router.push("/incidents")}
            className="nav-btn"
            title="Mission Control — incident intelligence dashboard"
            aria-label="Go to incidents"
          >
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">Incidents</span>
          </button>

          <button
            onClick={() => router.push("/evaluation")}
            className="nav-btn"
            title="Coverage, sentiment breakdown, and data quality metrics"
            aria-label="Data quality report"
          >
            <BarChart2 className="w-3 h-3" />
            <span className="hidden sm:inline">Data Quality</span>
          </button>

          <button
            onClick={() => setReplayOpen(true)}
            className="nav-btn"
            title="Replay the last 48 hours of brand mentions at 5× speed"
            aria-label="Simulate feed replay"
          >
            <Play className="w-3 h-3" />
            <span className="hidden sm:inline">Simulate Feed</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-5 space-y-4 max-w-[1800px] mx-auto w-full">
        {/* ── Hero Strip ──────────────────────────────────────────────── */}
        <HeroStrip heroData={heroData} loading={heroLoading} />

        {/* ── KPI Strip ───────────────────────────────────────────────── */}
        <KPIStrip />

        {/* ── Main grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Live Feed — left */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3" style={{ minHeight: "480px", maxHeight: "600px", overflow: "hidden" }}>
            <LiveFeed />
          </div>

          {/* Crisis Radar — center */}
          <div className="col-span-12 md:col-span-4 lg:col-span-4" style={{ minHeight: "480px", maxHeight: "600px", overflow: "hidden" }}>
            <CrisisRadar />
          </div>

          {/* Issue Heatmap — right */}
          <div className="col-span-12 md:col-span-4 lg:col-span-5" style={{ minHeight: "480px", maxHeight: "600px", overflow: "hidden" }}>
            <IssueHeatmap />
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5">
            <DailyBrief />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <CompetitorPanel />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <TrustNarrativeWidget />
          </div>
        </div>
      </main>

      {replayOpen && <ReplayMode onClose={() => setReplayOpen(false)} />}
    </div>
  );
}
