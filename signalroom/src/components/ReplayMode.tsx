"use client";
import { useState, useEffect, useRef } from "react";

interface ReplayEvent {
  id: string;
  channel: string;
  timestamp: string;
  text: string;
  sentimentLabel: string;
  topIssue?: string;
  credibilityScore: number;
  engagement: number;
  blastRadius: string;
  replayDelayMs: number;
  isSimulated: boolean;
}

const CHANNEL_ICONS: Record<string, string> = {
  amazon: "📦", nykaa: "💄", google: "⭐", reddit: "🔴",
  twitter: "🐦", instagram: "📸", complaints: "📋",
};

const CHANNEL_LABELS: Record<string, string> = {
  amazon: "Amazon", nykaa: "Nykaa", google: "Google",
  reddit: "Reddit", twitter: "Twitter", instagram: "Instagram", complaints: "Complaints",
};

export default function ReplayMode({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [visible, setVisible] = useState<ReplayEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/replay?hoursBack=48");
      const data = await res.json();
      setEvents(data.events || []);
      setLoaded(true);
    };
    load();
  }, []);

  const startReplay = () => {
    setVisible([]);
    setProgress(0);
    setPlaying(true);

    const maxDelay = Math.max(...events.map(e => e.replayDelayMs), 1);
    let shown = 0;

    events.forEach(event => {
      setTimeout(() => {
        setVisible(prev => [event, ...prev].slice(0, 50));
        shown++;
        setProgress(Math.round((shown / events.length) * 100));
        feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, event.replayDelayMs + 100);
    });

    setTimeout(() => setPlaying(false), maxDelay + 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-gray-700/60 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${playing ? "bg-red-500 animate-pulse" : "bg-gray-600"}`} />
            <div>
              <h2 className="font-semibold text-white text-sm">Feed Simulation</h2>
              <p className="text-[11px] text-gray-500">Replay last 48 hours of mentions at 5× speed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-b border-gray-700/40 flex items-center gap-3">
          {!loaded ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
              </svg>
              Loading events…
            </div>
          ) : (
            <>
              <button
                onClick={startReplay}
                disabled={playing || events.length === 0}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  playing
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-red-700 hover:bg-red-600 text-white"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {playing ? "Playing…" : "Start Replay"}
              </button>
              <span className="text-sm text-gray-400">{events.length} events</span>
              {playing && (
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 w-8 text-right">{progress}%</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Event feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {visible.length === 0 && !playing && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">▶</div>
              <p className="text-gray-500 text-sm font-medium mb-1">Ready to simulate</p>
              <p className="text-gray-600 text-xs">Press Start Replay to watch the last 48 hours unfold</p>
            </div>
          )}
          {visible.map((event) => (
            <div
              key={event.id}
              className={`rounded-xl p-3 border transition-all ${
                event.blastRadius === "high_risk"
                  ? "bg-red-950/30 border-red-800/50"
                  : event.sentimentLabel === "neg"
                  ? "bg-gray-800/60 border-gray-700/50"
                  : "bg-gray-800/30 border-gray-800/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="shrink-0">{CHANNEL_ICONS[event.channel] || "📢"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs flex-wrap">
                    <span className="text-gray-300 font-medium">{CHANNEL_LABELS[event.channel] || event.channel}</span>
                    {event.topIssue && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-400 text-[10px]">
                        {event.topIssue.replace(/_/g, " ")}
                      </span>
                    )}
                    {event.blastRadius === "high_risk" && (
                      <span className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 text-[10px] border border-red-800/40 animate-pulse font-medium">
                        🔴 High Risk
                      </span>
                    )}
                    <span className="ml-auto text-gray-600 text-[10px]">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{event.text}</p>
                  {event.engagement > 50 && (
                    <p className="text-[10px] text-orange-400 mt-1">⚡ {event.engagement} engagements</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
