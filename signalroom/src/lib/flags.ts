// Feature flags — server-side reads process.env.FEATURE_*
// Client-side reads NEXT_PUBLIC_FEATURE_* (must be inlined at build time)

export interface ServerFlags {
  incidents: boolean;
  blastRadius: boolean;
  rootCause: boolean;
  simulator: boolean;
  narrativeRisk: boolean;
  guardrailedResponses: boolean;
  trustIndex: boolean;
  competitorWatch: boolean;
}

export interface ClientFlags {
  incidents: boolean;
  blastRadius: boolean;
  rootCause: boolean;
  simulator: boolean;
  narrativeRisk: boolean;
  guardrailedResponses: boolean;
  trustIndex: boolean;
  competitorWatch: boolean;
}

function boolEnv(key: string, fallback = true): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v !== "false" && v !== "0";
}

/** Read server-side feature flags (call only in server context). */
export function serverFlags(): ServerFlags {
  return {
    incidents:            boolEnv("FEATURE_INCIDENTS"),
    blastRadius:          boolEnv("FEATURE_BLAST_RADIUS"),
    rootCause:            boolEnv("FEATURE_ROOT_CAUSE"),
    simulator:            boolEnv("FEATURE_SIMULATOR"),
    narrativeRisk:        boolEnv("FEATURE_NARRATIVE_RISK"),
    guardrailedResponses: boolEnv("FEATURE_GUARDRAILED_RESPONSES"),
    trustIndex:           boolEnv("FEATURE_TRUST_INDEX"),
    competitorWatch:      boolEnv("FEATURE_COMPETITOR_WATCH"),
  };
}

/** Read client-side feature flags (safe to call in "use client" components). */
export function clientFlags(): ClientFlags {
  return {
    incidents:            process.env.NEXT_PUBLIC_FEATURE_INCIDENTS            !== "false",
    blastRadius:          process.env.NEXT_PUBLIC_FEATURE_BLAST_RADIUS         !== "false",
    rootCause:            process.env.NEXT_PUBLIC_FEATURE_ROOT_CAUSE           !== "false",
    simulator:            process.env.NEXT_PUBLIC_FEATURE_SIMULATOR            !== "false",
    narrativeRisk:        process.env.NEXT_PUBLIC_FEATURE_NARRATIVE_RISK       !== "false",
    guardrailedResponses: process.env.NEXT_PUBLIC_FEATURE_GUARDRAILED_RESPONSES !== "false",
    trustIndex:           process.env.NEXT_PUBLIC_FEATURE_TRUST_INDEX          !== "false",
    competitorWatch:      process.env.NEXT_PUBLIC_FEATURE_COMPETITOR_WATCH     !== "false",
  };
}
