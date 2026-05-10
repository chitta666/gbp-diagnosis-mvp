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

function formatRate(value) {
  if (value == null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function formatFunnel(name, funnel = {}) {
  return `${name}: clicked=${funnel.clicked || 0} submitted=${funnel.submitted || 0} rate=${formatRate(
    funnel.submittedPerClick
  )}`;
}

function formatRecord(record) {
  return [
    `- ${record.createdAt} | ${record.event} | ${record.page} | ${record.lang}`,
    `  source=${record.source || "unknown"} intent=${record.intent || "none"} type=${
      record.feedbackType || "none"
    } saved=${record.hasSavedListing} competitor=${record.hasCompetitor}`,
  ].join("\n");
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
    args.origin || process.env.EVENTS_SUMMARY_ORIGIN || "https://gbp-diagnosis-mvp.pages.dev"
  );
  const token = String(args.token || process.env.FEEDBACK_ADMIN_TOKEN || "").trim();
  const outputPath = String(args.output || process.env.EVENTS_SUMMARY_OUTPUT || "").trim();

  if (!origin) {
    throw new Error("Set --origin or EVENTS_SUMMARY_ORIGIN before running events summary.");
  }

  if (!token) {
    throw new Error("Set --token or FEEDBACK_ADMIN_TOKEN before running events summary.");
  }

  const url = new URL(`${origin}/api/events-summary`);
  addParam(url, "days", args.days);
  addParam(url, "limit", args.limit);
  addParam(url, "event", args.event);
  addParam(url, "source", args.source);
  addParam(url, "intent", args.intent);

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
    throw new Error(`Events summary request failed (${response.status}).\n${details}`);
  }

  await writeOutputIfRequested(outputPath, payload);

  console.log(`events returned=${payload.returned} scanned=${payload.scanned} days=${payload.days}`);
  console.log(`byEvent: ${formatCounts(payload.counts?.byEvent) || "none"}`);
  console.log(`bySource: ${formatCounts(payload.counts?.bySource) || "none"}`);
  console.log(`byIntent: ${formatCounts(payload.counts?.byIntent) || "none"}`);

  if (payload.benchmarkFunnel) {
    console.log("benchmark funnel:");
    console.log(formatFunnel("  beta", payload.benchmarkFunnel.beta));
    console.log(formatFunnel("  report", payload.benchmarkFunnel.report));
    console.log(formatFunnel("  total", payload.benchmarkFunnel.total));
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
