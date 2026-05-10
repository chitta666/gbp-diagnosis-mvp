import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;

    const keyValue = part.slice(2).split("=");
    const key = keyValue[0];
    if (!key) continue;

    if (keyValue.length > 1) {
      args[key] = keyValue.slice(1).join("=");
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function addParam(url, key, value) {
  const clean = String(value || "").trim();
  if (clean) url.searchParams.set(key, clean);
}

function formatCounts(counts = {}) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join(", ");
}

function formatMinuteStats(stats = {}) {
  if (!stats.count) return "none";
  return [
    `count:${stats.count}`,
    `total:${stats.total}m`,
    `avg:${stats.average}m`,
    `median:${stats.median}m`,
    `min:${stats.min}m`,
    `max:${stats.max}m`,
  ].join(", ");
}

function formatRecord(record) {
  const bits = [
    record.createdAt,
    record.type,
    record.intent,
    record.context?.placeName,
    record.context?.competitorName ? `vs ${record.context.competitorName}` : "",
  ].filter(Boolean);

  const lines = [
    `- ${bits.join(" | ")}`,
    `  tags: ${(record.tags || []).join(", ") || "none"}`,
  ];

  if (record.benchmark && Object.keys(record.benchmark).length) {
    for (const [key, value] of Object.entries(record.benchmark)) {
      if (value) lines.push(`  ${key}: ${value}`);
    }
  } else if (record.message) {
    lines.push(`  message: ${record.message}`);
  }

  if (record.email) lines.push(`  email: ${record.email}`);
  return lines.join("\n");
}

async function writeOutputIfRequested(outputPath, payload) {
  if (!outputPath) return;
  const fullPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = normalizeOrigin(
    args.origin || process.env.FEEDBACK_SUMMARY_ORIGIN || "https://gbp-diagnosis-mvp.pages.dev"
  );
  const token = String(args.token || process.env.FEEDBACK_ADMIN_TOKEN || "").trim();
  const outputPath = String(args.output || process.env.FEEDBACK_SUMMARY_OUTPUT || "").trim();

  if (!origin) {
    throw new Error("Set --origin or FEEDBACK_SUMMARY_ORIGIN before running feedback summary.");
  }

  if (!token) {
    throw new Error("Set --token or FEEDBACK_ADMIN_TOKEN before running feedback summary.");
  }

  const url = new URL(`${origin}/api/feedback-summary`);
  addParam(url, "tag", args.tag);
  addParam(url, "intent", args.intent);
  addParam(url, "type", args.type);
  addParam(url, "limit", args.limit);

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || typeof payload !== "object") {
    const details = payload ? JSON.stringify(payload, null, 2) : text;
    throw new Error(`Feedback summary request failed (${response.status}).\n${details}`);
  }

  await writeOutputIfRequested(outputPath, payload);

  console.log(
    `feedback returned=${payload.returned} scanned=${payload.scanned} totalIndexed=${payload.totalIndexed}`
  );
  console.log(`byType: ${formatCounts(payload.counts?.byType) || "none"}`);
  console.log(`byIntent: ${formatCounts(payload.counts?.byIntent) || "none"}`);
  console.log(`byTag: ${formatCounts(payload.counts?.byTag) || "none"}`);

  if (payload.benchmarkStats) {
    const benchmarkStats = payload.benchmarkStats;
    console.log(
      `benchmark: records=${benchmarkStats.records || 0} saved=${formatMinuteStats(
        benchmarkStats.estimatedMinutesSaved
      )}`
    );
    console.log(
      [
        `benchmarkFields: usualPrep=${benchmarkStats.withUsualPrepTime || 0}`,
        `flowmetricTime=${benchmarkStats.withFlowmetricTime || 0}`,
        `reusableSentence=${benchmarkStats.withReusableClientSentence || 0}`,
        `rewriteNeeds=${benchmarkStats.withRewriteNeeds || 0}`,
        `trustGaps=${benchmarkStats.withTrustGaps || 0}`,
      ].join(", ")
    );
  }

  if (Array.isArray(payload.recent) && payload.recent.length) {
    console.log("\nrecent:");
    payload.recent.forEach((record) => console.log(formatRecord(record)));
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
