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

function toBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function formatCheck(check) {
  const state = check.ok ? "OK" : check.skipped ? "SKIP" : "FAIL";
  const extras = [
    `http=${check.httpStatus}`,
    check.code ? `code=${check.code}` : null,
    check.upstreamStatus ? `upstreamStatus=${check.upstreamStatus}` : null,
    Number(check.consecutiveFailures || 0) > 0 ? `streak=${check.consecutiveFailures}` : null,
    check.message ? `message=${check.message}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `[${state}] ${check.name} ${extras}`.trim();
}

function buildMarkdownSummary(result, endpointUrl) {
  const lines = [
    `# Core Health Check`,
    ``,
    `- origin: ${result.origin}`,
    `- mode: ${result.mode}`,
    `- ok: ${result.ok}`,
    `- startedAt: ${result.startedAt}`,
    `- finishedAt: ${result.finishedAt}`,
    `- endpoint: ${endpointUrl}`,
    ``,
    `## Checks`,
    ``,
    ...result.checks.map((check) => `- ${formatCheck(check)}`),
  ];

  if (Array.isArray(result.alertableChecks) && result.alertableChecks.length) {
    lines.push("", "## Alertable Checks", "", ...result.alertableChecks.map((check) => `- ${formatCheck(check)}`));
  }

  if (result.alert) {
    lines.push(
      "",
      "## Alert",
      "",
      `- attempted: ${result.alert.attempted}`,
      `- sent: ${result.alert.sent}`,
      `- skippedReason: ${result.alert.skippedReason ?? "none"}`
    );
  }

  return `${lines.join("\n")}\n`;
}

async function writeOutputIfRequested(outputPath, payload) {
  if (!outputPath) return;
  const fullPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function appendGitHubSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await fs.appendFile(summaryPath, markdown, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = normalizeOrigin(
    args.origin || process.env.HEALTHCHECK_BASE_URL || process.env.HEALTHCHECK_ORIGIN
  );
  const secret = String(args.secret || process.env.HEALTHCHECK_SECRET || "").trim();
  const mode = String(args.mode || process.env.HEALTHCHECK_MODE || "health").trim();
  const notify = toBoolean(args.notify ?? process.env.HEALTHCHECK_NOTIFY, mode !== "smoke");
  const query = String(args.query || process.env.HEALTHCHECK_QUERY || "").trim();
  const snapshotPlaceId = String(
    args["snapshot-place-id"] || process.env.HEALTHCHECK_SNAPSHOT_PLACE_ID || ""
  ).trim();
  const alertEmail = String(args["alert-email"] || process.env.HEALTH_ALERT_EMAIL || "").trim();
  const outputPath = String(args.output || process.env.HEALTHCHECK_OUTPUT || "").trim();

  if (!origin) {
    throw new Error("Set --origin or HEALTHCHECK_BASE_URL before running the health check.");
  }

  if (!secret) {
    throw new Error("Set --secret or HEALTHCHECK_SECRET before running the health check.");
  }

  const endpointUrl = `${origin}/api/health-check`;
  const requestBody = {
    mode,
    notify,
  };
  if (query) requestBody.query = query;
  if (snapshotPlaceId) requestBody.snapshotPlaceId = snapshotPlaceId;
  if (alertEmail) requestBody.alertEmail = alertEmail;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
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
    throw new Error(`Health check request failed (${response.status}).\n${details}`);
  }

  await writeOutputIfRequested(outputPath, payload);

  for (const check of payload.checks || []) {
    console.log(formatCheck(check));
  }
  console.log(
    `result ok=${payload.ok} mode=${payload.mode} startedAt=${payload.startedAt} finishedAt=${payload.finishedAt}`
  );

  const markdown = buildMarkdownSummary(payload, endpointUrl);
  await appendGitHubSummary(markdown);

  if (!payload.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
