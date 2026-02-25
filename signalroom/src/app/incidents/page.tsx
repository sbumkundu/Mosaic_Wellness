"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Search, RefreshCw, Download,
  ChevronUp, ChevronDown, ChevronsUpDown, X,
  Package, Radio, SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTableRow } from "@/components/ui/Skeleton";

interface IncidentRow {
  id: string;
  title: string;
  status: string;
  severity: string;
  primaryChannel: string | null;
  productId: string | null;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  summary: string | null;
  impactScore: number | null;
  narrativeRiskLevel: string | null;
  narrativeRiskScore: number | null;
  trustIndexDelta: number | null;
}

// ── Style maps ──────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  active: "bg-red-400 animate-pulse",
  investigating: "bg-yellow-400",
  resolved: "bg-green-400",
  dismissed: "bg-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const CHANNEL_ICONS: Record<string, string> = {
  amazon: "📦",
  nykaa: "💄",
  google: "⭐",
  reddit: "🔴",
  twitter: "🐦",
  instagram: "📸",
  complaints: "📋",
};

type SortKey = "severity" | "impactScore" | "createdAt" | "trustIndexDelta";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const SORT_PRESETS: { label: string; key: SortKey; dir: SortDir }[] = [
  { label: "Most Urgent", key: "severity", dir: "desc" },
  { label: "Newest", key: "createdAt", dir: "desc" },
  { label: "Highest Impact", key: "impactScore", dir: "desc" },
  { label: "Trust Delta", key: "trustIndexDelta", dir: "asc" },
];

function sortIncidents(rows: IncidentRow[], key: SortKey, dir: SortDir): IncidentRow[] {
  return [...rows].sort((a, b) => {
    let av: number, bv: number;
    if (key === "severity") {
      av = SEVERITY_ORDER[a.severity] ?? 0;
      bv = SEVERITY_ORDER[b.severity] ?? 0;
    } else if (key === "createdAt") {
      av = new Date(a.createdAt).getTime();
      bv = new Date(b.createdAt).getTime();
    } else {
      av = a[key] ?? -Infinity;
      bv = b[key] ?? -Infinity;
    }
    return dir === "asc" ? av - bv : bv - av;
  });
}

function SortIcon({ col, activeKey, activeDir }: { col: SortKey; activeKey: SortKey; activeDir: SortDir }) {
  if (col !== activeKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return activeDir === "desc"
    ? <ChevronDown className="w-3 h-3 text-cyan-400" />
    : <ChevronUp className="w-3 h-3 text-cyan-400" />;
}

// ── Impact score pill ────────────────────────────────────────────────
function ImpactScore({ score }: { score: number }) {
  const color = score >= 70 ? "text-red-400" : score >= 40 ? "text-orange-400" : "text-yellow-400";
  const bar = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : "bg-yellow-500";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px]">
      <span className={`text-sm font-bold ${color}`}>{score}</span>
      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activePreset, setActivePreset] = useState("Most Urgent");

  const searchRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = search || filterStatus || filterSeverity || filterChannel;
  const activeFilterCount = [filterStatus, filterSeverity, filterChannel].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterSeverity("");
    setFilterChannel("");
  };

  // Close filter popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    if (showFilters) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterSeverity) params.set("severity", filterSeverity);
    if (filterChannel) params.set("channel", filterChannel);
    const res = await fetch(`/api/incidents?${params}`);
    const data = await res.json();
    setIncidents(data.incidents || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [filterStatus, filterSeverity, filterChannel]);

  useEffect(() => { load(); }, [load]);

  const runDetection = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(`Detected ${data.newIncidents} new incident${data.newIncidents !== 1 ? "s" : ""}`);
        await load();
      } else {
        setResult(data.error);
      }
    } catch (e: unknown) {
      setResult((e as Error).message);
    }
    setRunning(false);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setActivePreset("");
  };

  const applyPreset = (preset: typeof SORT_PRESETS[0]) => {
    setSortKey(preset.key);
    setSortDir(preset.dir);
    setActivePreset(preset.label);
  };

  // Client-side search + sort
  const filtered = sortIncidents(
    incidents.filter(inc => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.summary?.toLowerCase().includes(q) ||
        inc.productId?.toLowerCase().includes(q) ||
        inc.primaryChannel?.toLowerCase().includes(q)
      );
    }),
    sortKey,
    sortDir
  );

  const resultOk = result != null && !result.toLowerCase().includes("error") && !result.startsWith("✗");

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Incidents" },
        ]}
        statusMessage={result ? { text: resultOk ? `✓ ${result}` : `✗ ${result}`, ok: resultOk } : null}
        actions={
          <button
            onClick={runDetection}
            disabled={running}
            className="nav-btn"
            title="Detect incidents from existing mention data"
          >
            {running
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Download className="w-3 h-3" />}
            <span className="hidden sm:inline">{running ? "Detecting…" : "Detect Incidents"}</span>
          </button>
        }
      />

      <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full space-y-3">

        {/* ── Filter + Sort Bar ──────────────────────────────────────── */}
        <div className="filter-bar">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search incidents…"
              className="search-input"
              aria-label="Search incidents"
            />
          </div>

          <div className="w-px h-5 bg-gray-700 shrink-0" />

          {/* Filters popover */}
          <div className="relative" ref={filtersRef}>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`nav-btn ${showFilters ? "bg-gray-700 border-gray-600" : ""}`}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-cyan-500 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilters && (
              <div className="filters-popover">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Status</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Filter by status"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Severity</label>
                  <select
                    value={filterSeverity}
                    onChange={e => setFilterSeverity(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Filter by severity"
                  >
                    <option value="">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Channel</label>
                  <select
                    value={filterChannel}
                    onChange={e => setFilterChannel(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                    aria-label="Filter by channel"
                  >
                    <option value="">All Channels</option>
                    {["amazon", "nykaa", "google", "reddit", "twitter", "instagram", "complaints"].map(c => (
                      <option key={c} value={c}>{CHANNEL_ICONS[c]} {c}</option>
                    ))}
                  </select>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { clearFilters(); setShowFilters(false); }}
                    className="text-[11px] text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors mt-1"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors"
              aria-label="Clear all filters"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="w-px h-5 bg-gray-700 shrink-0 hidden sm:block" />

          {/* Sort presets */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 shrink-0">Sort:</span>
            {SORT_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  activePreset === preset.label
                    ? "border-cyan-700/60 bg-cyan-900/20 text-cyan-300"
                    : "border-gray-700 bg-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="ml-auto text-xs text-gray-500 shrink-0">
            {search
              ? `${filtered.length} of ${total}`
              : `${total} incident${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="panel overflow-hidden">
          {loading ? (
            <table className="triage-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Incident</th>
                  <th>Channel</th>
                  <th>Impact</th>
                  <th>PR Risk</th>
                  <th>Trust Δ</th>
                  <th>Window</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(6)].map((_, i) => <SkeletonTableRow key={i} cols={8} />)}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={
                incidents.length === 0
                  ? <AlertTriangle className="w-6 h-6 text-gray-500" />
                  : <Search className="w-6 h-6 text-gray-500" />
              }
              title={
                incidents.length === 0
                  ? "No incidents detected yet"
                  : "No incidents match your filters"
              }
              description={
                incidents.length === 0
                  ? 'Run "Detect Incidents" to automatically surface patterns from your mention data. This analyses volume spikes, cross-channel spread, and narrative risk.'
                  : "Try broadening your search or clearing the active filters."
              }
              action={
                incidents.length === 0 ? (
                  <button onClick={runDetection} disabled={running} className="nav-btn">
                    {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Detect Incidents
                  </button>
                ) : (
                  <button onClick={clearFilters} className="nav-btn">
                    <X className="w-3 h-3" /> Clear Filters
                  </button>
                )
              }
              hint={
                incidents.length === 0
                  ? "Make sure you've loaded mention data first (Load Data in the dashboard)."
                  : undefined
              }
            />
          ) : (
            <table className="triage-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>
                    <button className={`sort-btn ${sortKey === "severity" ? "active" : ""}`} onClick={() => handleSort("severity")}>
                      Severity <SortIcon col="severity" activeKey={sortKey} activeDir={sortDir} />
                    </button>
                  </th>
                  <th style={{ minWidth: 240 }}>Incident</th>
                  <th>Channel</th>
                  <th>
                    <button className={`sort-btn ${sortKey === "impactScore" ? "active" : ""}`} onClick={() => handleSort("impactScore")}>
                      Impact <SortIcon col="impactScore" activeKey={sortKey} activeDir={sortDir} />
                    </button>
                  </th>
                  <th>PR Risk</th>
                  <th>
                    <button className={`sort-btn ${sortKey === "trustIndexDelta" ? "active" : ""}`} onClick={() => handleSort("trustIndexDelta")}>
                      Trust Δ <SortIcon col="trustIndexDelta" activeKey={sortKey} activeDir={sortDir} />
                    </button>
                  </th>
                  <th>
                    <button className={`sort-btn ${sortKey === "createdAt" ? "active" : ""}`} onClick={() => handleSort("createdAt")}>
                      Detected <SortIcon col="createdAt" activeKey={sortKey} activeDir={sortDir} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => (
                  <tr
                    key={inc.id}
                    onClick={() => router.push(`/incidents/${inc.id}`)}
                    onKeyDown={e => e.key === "Enter" && router.push(`/incidents/${inc.id}`)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View incident: ${inc.title}`}
                  >
                    {/* Status */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[inc.status] ?? "bg-gray-500"}`} />
                        <span className="text-gray-400 text-xs">{STATUS_LABEL[inc.status] ?? inc.status}</span>
                      </div>
                    </td>

                    {/* Severity */}
                    <td>
                      <RiskBadge severity={inc.severity} />
                    </td>

                    {/* Incident title + summary */}
                    <td style={{ maxWidth: 320 }}>
                      <div className="font-medium text-gray-200 truncate text-[13px]" title={inc.title}>
                        {inc.title}
                      </div>
                      {inc.summary && (
                        <div className="text-[11px] text-gray-500 truncate mt-0.5" title={inc.summary}>
                          {inc.summary}
                        </div>
                      )}
                      {inc.productId && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-0.5">
                          <Package className="w-2.5 h-2.5" />
                          {inc.productId}
                        </div>
                      )}
                    </td>

                    {/* Channel */}
                    <td>
                      {inc.primaryChannel ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <span>{CHANNEL_ICONS[inc.primaryChannel] ?? "📡"}</span>
                          <span className="capitalize">{inc.primaryChannel}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-600 text-xs">
                          <Radio className="w-3 h-3" />
                          <span>—</span>
                        </div>
                      )}
                    </td>

                    {/* Impact score */}
                    <td>
                      {inc.impactScore != null
                        ? <ImpactScore score={inc.impactScore} />
                        : <span className="text-gray-600 text-xs">—</span>}
                    </td>

                    {/* PR Escalation Risk (formerly Narrative Risk) */}
                    <td>
                      {inc.narrativeRiskLevel
                        ? <RiskBadge severity={inc.narrativeRiskLevel} score={inc.narrativeRiskScore ?? undefined} size="sm" tooltip={`PR Escalation Risk: ${inc.narrativeRiskLevel}${inc.narrativeRiskScore != null ? ` (score: ${inc.narrativeRiskScore})` : ""}`} />
                        : <span className="text-gray-600 text-xs">—</span>}
                    </td>

                    {/* Trust delta */}
                    <td>
                      {inc.trustIndexDelta != null ? (
                        <span className={`text-sm font-semibold tabular-nums ${inc.trustIndexDelta < 0 ? "text-red-400" : "text-green-400"}`}>
                          {inc.trustIndexDelta > 0 ? "+" : ""}{inc.trustIndexDelta}
                        </span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>

                    {/* Detected / window */}
                    <td>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(inc.windowStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(inc.windowEnd).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
