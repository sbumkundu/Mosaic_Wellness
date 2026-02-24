"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

interface BrandData {
  brand: string;
  healthScore: number;
  avgSentiment: number;
  negRatio: number;
  topIssue: string | null;
  mentionCount: number;
  dailyScores: Array<{ date: string; score: number }>;
  channelBreakdown: Array<{ channel: string; count: number }>;
}

const BRAND_COLORS = ["#06b6d4", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#3b82f6"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function CompetitorPanel() {
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [topDiff, setTopDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/benchmark?days=14");
        const data = await res.json();
        setBrands(data.brands || []);
        setTopDiff(data.topDifferentiatingIssue);
      } catch {}
      setLoading(false);
    };
    fetch_();
  }, []);

  const allDates = Array.from(new Set(brands.flatMap(b => b.dailyScores.map(d => d.date)))).sort();
  const chartData = allDates.map(date => {
    const row: Record<string, any> = { date: date.slice(5) };
    for (const brand of brands) {
      const pt = brand.dailyScores.find(d => d.date === date);
      row[brand.brand] = pt?.score ?? null;
    }
    return row;
  });

  return (
    <div className="panel p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="panel-title">Competitive Benchmark</h2>
          <p className="panel-subtitle">14-day brand health score vs. competitors (0–100)</p>
        </div>
        {topDiff && (
          <span className="text-[11px] px-2 py-1 rounded-lg bg-red-900/30 text-red-400 border border-red-800/50 shrink-0 ml-3">
            ⚠ Gap: {topDiff.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-52 bg-gray-800/60 animate-pulse rounded-xl" />
      ) : (
        <>
          {/* Brand score cards */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {brands.map((brand, i) => {
              const scoreColor = brand.healthScore >= 70 ? "#10b981" : brand.healthScore >= 45 ? "#f59e0b" : "#ef4444";
              const isOwn = brand.brand === "MosaicWellness";
              return (
                <div
                  key={brand.brand}
                  className={`flex-shrink-0 min-w-[108px] p-2.5 rounded-xl border ${
                    isOwn
                      ? "bg-cyan-950/30 border-cyan-800/40"
                      : "bg-gray-800/60 border-gray-700/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                    <span className="text-[11px] text-gray-300 truncate font-medium">{brand.brand}</span>
                    {isOwn && <span className="text-[9px] text-cyan-500 shrink-0">You</span>}
                  </div>
                  <div className="text-xl font-bold mb-0.5" style={{ color: scoreColor }}>
                    {brand.healthScore}
                  </div>
                  <div className="text-[10px] text-gray-500">{brand.negRatio}% negative</div>
                  {brand.topIssue && (
                    <div className="text-[10px] text-gray-600 truncate mt-0.5">{brand.topIssue.replace(/_/g, " ")}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trend chart */}
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={175}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af", paddingTop: 6 }} />
                {brands.map((brand, i) => (
                  <Line
                    key={brand.brand}
                    type="monotone"
                    dataKey={brand.brand}
                    stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                    strokeWidth={brand.brand === "MosaicWellness" ? 2.5 : 1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-600 text-xs">
              No trend data available yet
            </div>
          )}
        </>
      )}
    </div>
  );
}
