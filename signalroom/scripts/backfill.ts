#!/usr/bin/env tsx
// CLI backfill script — run with: npx tsx scripts/backfill.ts
// Requires DATABASE_URL env var (or falls back to file:./prisma/dev.db)

import "dotenv/config";

async function main() {
  const baseUrl = process.env.BACKFILL_BASE_URL || "http://localhost:3000";
  const token = process.env.BACKFILL_TOKEN || "";

  console.log("SignalRoom Backfill CLI");
  console.log("======================");
  console.log(`Target: ${baseUrl}/api/admin/backfill`);
  console.log("Starting...\n");

  const res = await fetch(`${baseUrl}/api/admin/backfill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-backfill-token": token } : {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Backfill failed:", data.error);
    console.error("Log:\n", (data.log || []).join("\n"));
    process.exit(1);
  }

  console.log((data.log || []).join("\n"));
  console.log("\nSummary:");
  console.log(`  Incidents total:     ${data.incidents}`);
  console.log(`  New incidents:       ${data.newIncidents}`);
  console.log(`  Competitor events:   ${data.competitorIncidents}`);
  console.log(`  Opportunities:       ${data.opportunities}`);
  console.log(`  Duration:            ${data.durationMs}ms`);

  if (data.topIncidents?.length > 0) {
    console.log("\nTop incidents by impact:");
    for (const inc of data.topIncidents) {
      console.log(`  [${inc.impactScore}/100] ${inc.title}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
