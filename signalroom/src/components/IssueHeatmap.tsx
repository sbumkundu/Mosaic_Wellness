"use client";
import { useEffect, useState } from "react";

interface HeatmapCell {
  issue: string;
  count: number;
  negCount: number;
  intensity: number;
}

interface HeatmapRow {
  product: string;
  issues: HeatmapCell[];
}

const ISSUE_LABELS: Record<string, string> = {
  product_quality: "Quality",
  delivery: "Delivery",
  packaging: "Pack",
  pricing: "Price",
  support: "Support",
  side_effects: "Side FX",
  billing: "Billing",
  trust_authenticity: "Trust",
};

function intensityToColor(intensity: number, hasData: boolean): string {
  if (!hasData) return "bg-gray-800/50 text-gray-700";
  if (intensity === 0) return "bg-teal-900/70 text-teal-300";
  if (intensity > 0.7) return "bg-red-600 text-white";
  if (intensity > 0.5) return "bg-red-500/80 text-white";
  if (intensity > 0.3) return "bg-orange-500/70 text-white";
  if (intensity > 0.15) return "bg-yellow-600/70 text-white";
  return "bg-yellow-900/60 text-yellow-300";
}

function intensityToLabel(v: number): string {
  if (v === 0) return "None";
  if (v <= 0.2) return "Low";
  if (v <= 0.4) return "Moderate";
  if (v <= 0.6) return "High";
  return "Critical";
}

export default function IssueHeatmap() {
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/issues/heatmap?days=730");
        const data = await res.json();
        setHeatmap(data.heatmap || []);
        setIssues(data.issues || []);
      } catch {}
      setLoading(false);
    };
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <h2 className="panel-title">Issue Heatmap</h2>
        <p className="panel-subtitle">
          Issue distribution by product · teal = positive · red = negative
        </p>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading && (
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-800 rounded" />)}
          </div>
        )}

        {!loading && heatmap.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-10">
            <div className="text-2xl mb-2">📭</div>
            No data yet — load data first
          </div>
        )}

        {!loading && heatmap.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-1.5 text-gray-500 font-medium w-28 text-[11px]">Product</th>
                  {issues.map(issue => (
                    <th key={issue} className="p-1 text-gray-500 font-medium text-center text-[11px]" style={{ minWidth: "52px" }}>
                      {ISSUE_LABELS[issue] || issue}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map(row => (
                  <tr key={row.product} className="hover:bg-gray-800/20 transition-colors">
                    <td className="p-1.5 text-gray-300 font-medium truncate max-w-[7rem] text-[11px]" title={row.product}>
                      {row.product.length > 14 ? row.product.slice(0, 13) + "…" : row.product}
                    </td>
                    {row.issues.map(cell => (
                      <td key={cell.issue} className="p-1 text-center">
                        <div
                          className={`rounded text-[11px] font-mono py-1 px-0.5 ${intensityToColor(cell.intensity, cell.count > 0)}`}
                          title={`${cell.negCount} negative out of ${cell.count} total (${Math.round(cell.intensity * 100)}% — ${intensityToLabel(cell.intensity)})`}
                        >
                          {cell.count > 0 ? cell.count : ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-800">
              <span className="text-[11px] text-gray-500 shrink-0">Risk level:</span>
              {[
                { v: 0, label: "None", hasData: false },
                { v: 0, label: "Positive", hasData: true },
                { v: 0.2, label: "Low", hasData: true },
                { v: 0.4, label: "Moderate", hasData: true },
                { v: 0.6, label: "High", hasData: true },
                { v: 0.8, label: "Critical", hasData: true },
              ].map(({ v, label, hasData }) => (
                <div key={v} className="flex items-center gap-1">
                  <div className={`w-4 h-3 rounded ${intensityToColor(v, hasData)}`} />
                  <span className="text-[10px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
