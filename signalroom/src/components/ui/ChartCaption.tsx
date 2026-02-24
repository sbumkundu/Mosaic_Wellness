"use client";

interface ChartCaptionProps {
  text: string;
  /** Optional highlight for a key finding */
  highlight?: string;
}

/**
 * Caption below a Recharts chart explaining what the data means.
 *
 * Usage:
 *   <ChartCaption
 *     text="Trust index dropped 12 points over 14 days, now below the 50-point caution threshold."
 *     highlight="Below caution threshold"
 *   />
 */
export function ChartCaption({ text, highlight }: ChartCaptionProps) {
  return (
    <p className="text-[11px] text-gray-500 mt-2 leading-snug">
      {highlight && (
        <span className="text-amber-400 font-medium mr-1">{highlight} ·</span>
      )}
      {text}
    </p>
  );
}
