"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useRouter } from "next/navigation";

interface HealthRow {
  date: string;
  trustIndex: number;
  narrativeRiskIndex: number;
  sentimentIndex: number;
  volume: number;
}

function GaugeArc({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const circumference = 94.25;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#1f2937" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{Math.round(pct)}</span>
        </div>
      </div>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

export default function TrustNarrativeWidget() {
  const router = useRouter();
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [incidentCount, setIncidentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/health/trend")
      .then(r => r.json())
      .then(d => { setRows(d.rows || []); })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/incidents?limit=1")
      .then(r => r.json())
      .then(d => setIncidentCount(d.total ?? null))
      .catch(() => {});
  }, []);

  const latest = rows[rows.length - 1];
  const trustColor = !latest ? "#6b7280"
    : latest.trustIndex >= 70 ? "#10b981"
    : latest.trustIndex >= 45 ? "#f59e0b"
    : "#ef4444";
  const riskColor = !latest ? "#6b7280"
    : latest.narrativeRiskIndex >= 50 ? "#ef4444"
    : latest.narrativeRiskIndex >= 20 ? "#f59e0b"
    : "#10b981";

  if (loading) {
    return (
      <div className="panel p-4 animate-pulse">
        <div className="h-4 w-36 bg-gray-800 rounded mb-4" />
        <div className="h-24 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🛡</span>
          <h3 className="text-sm font-semibold text-gray-200">Trust &amp; Narrative Risk</h3>
        </div>
        <button
          onClick={() => router.push("/incidents")}
          className="nav-btn text-[11px] px-2.5 py-1"
        >
          {incidentCount != null ? `${incidentCount} Incident${incidentCount !== 1 ? "s" : ""}` : "Incidents"} →
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">No health data yet.</p>
          <p className="text-[11px] text-gray-600 mt-1">Run backfill from the Incidents page to populate.</p>
        </div>
      ) : (
        <>
          {/* Gauges */}
          <div className="flex items-center justify-around py-1">
            <GaugeArc value={latest?.trustIndex ?? 0} color={trustColor} label="Trust Index" />
            <div className="flex flex-col items-center gap-1">
              <div className="text-2xl font-bold" style={{ color: riskColor }}>
                {Math.round(latest?.narrativeRiskIndex ?? 0)}
              </div>
              <span className="text-[11px] text-gray-500">Narrative Risk</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold
                ${(latest?.narrativeRiskIndex ?? 0) >= 50
                  ? "text-red-400 bg-red-900/20 border-red-800/40"
                  : (latest?.narrativeRiskIndex ?? 0) >= 20
                  ? "text-yellow-400 bg-yellow-900/20 border-yellow-700/40"
                  : "text-green-400 bg-green-900/20 border-green-800/30"}`}>
                {(latest?.narrativeRiskIndex ?? 0) >= 50 ? "HIGH"
                  : (latest?.narrativeRiskIndex ?? 0) >= 20 ? "MED" : "LOW"}
              </span>
            </div>
          </div>

          {/* Trend chart */}
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={rows.slice(-14)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "11px" }}
              />
              <Line type="monotone" dataKey="trustIndex" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Trust" />
              <Line type="monotone" dataKey="narrativeRiskIndex" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Narrative Risk" />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
