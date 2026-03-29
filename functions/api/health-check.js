import { sendEmailNotification } from "../_lib/email.js";
import {
  DEFAULT_HEALTHCHECK_QUERY,
  DEFAULT_HEALTHCHECK_SNAPSHOT_PLACE_ID,
  runHealthChecks,
  shouldAlertFromHealthResult,
  summarizeHealthResult,
  withFailureStreaks,
} from "../_lib/healthChecks.js";

const HEALTH_LAST_KEY = "health:core:last";
const HEALTH_HISTORY_INDEX_KEY = "health:core:history:index";
const HEALTH_ALERT_KEY = "health:core:last-alert";
const ALERT_THROTTLE_MS = 6 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;

function safeJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function readJson(KV, key, fallback = null) {
  if (!KV) return fallback;
  const raw = await KV.get(key);
  return raw ? safeJson(raw, fallback) : fallback;
}

async function writeJson(KV, key, value) {
  if (!KV) return;
  await KV.put(key, JSON.stringify(value));
}

async function appendHistory(KV, summary) {
  if (!KV) return;
  const runKey = `health:core:run:${summary.startedAt}`;
  await writeJson(KV, runKey, summary);

  const ids = await readJson(KV, HEALTH_HISTORY_INDEX_KEY, []);
  const next = [runKey, ...(Array.isArray(ids) ? ids : [])].slice(0, HISTORY_LIMIT);
  await writeJson(KV, HEALTH_HISTORY_INDEX_KEY, next);
}

function authToken(request) {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();

  const direct = request.headers.get("x-healthcheck-secret");
  return direct ? direct.trim() : "";
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, x-healthcheck-secret",
    },
  });
}

function buildAlertEmail({ summary, origin, mode }) {
  const statusLines = summary.failingChecks.map((check) => {
    const extra = [
      check.code ? `code=${check.code}` : null,
      check.upstreamStatus ? `upstreamStatus=${check.upstreamStatus}` : null,
      Number(check.consecutiveFailures || 0) > 0
        ? `streak=${check.consecutiveFailures}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");

    return `- ${check.name}: HTTP ${check.httpStatus}${extra ? ` / ${extra}` : ""}${
      check.message ? ` / ${check.message}` : ""
    }`;
  });

  const subject = `[ALERT] GBP core health check failed (${summary.alertableChecks
    .map((check) => check.name)
    .join(", ")})`;
  const text = [
    `Origin: ${origin}`,
    `Mode: ${mode}`,
    `Started: ${summary.startedAt}`,
    `Finished: ${summary.finishedAt}`,
    "",
    ...statusLines,
    "",
    `Health status endpoint: ${origin}/api/health-status`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
      <h2 style="margin:0 0 12px;">GBP core health check failed</h2>
      <p style="margin:0 0 8px;"><strong>Origin:</strong> ${origin}</p>
      <p style="margin:0 0 8px;"><strong>Mode:</strong> ${mode}</p>
      <p style="margin:0 0 12px;"><strong>Finished:</strong> ${summary.finishedAt}</p>
      <ul style="padding-left:18px;margin:0 0 16px;">
        ${statusLines.map((line) => `<li>${line}</li>`).join("")}
      </ul>
      <p style="margin:0;">Status endpoint: ${origin}/api/health-status</p>
    </div>
  `;

  return { subject, text, html };
}

function shouldSendAlert({ summary, lastAlert }) {
  if (!summary.alertableChecks.length) return false;

  const signature = summary.alertableChecks
    .map((check) => `${check.name}:${check.code || check.httpStatus}`)
    .sort()
    .join("|");

  const sentAt = Date.parse(lastAlert?.sentAt || "");
  const signatureChanged = signature !== String(lastAlert?.signature || "");
  const staleAlert = !Number.isFinite(sentAt) || Date.now() - sentAt >= ALERT_THROTTLE_MS;

  return signatureChanged || staleAlert;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, x-healthcheck-secret",
      },
    });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const secret = env?.HEALTHCHECK_SECRET || env?.NOTIFICATION_SECRET || "";
  if (!secret) {
    return jsonResponse(
      {
        ok: false,
        error: "HEALTHCHECK_SECRET_NOT_CONFIGURED",
        message: "Set HEALTHCHECK_SECRET before running health checks.",
      },
      500
    );
  }

  const token = authToken(request);
  if (token !== secret) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  let body = {};
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const url = new URL(request.url);
  const mode = String(body?.mode || url.searchParams.get("mode") || "health").trim();
  const notifyRequested =
    body?.notify === true ||
    url.searchParams.get("notify") === "1" ||
    (!body?.notify && !url.searchParams.has("notify") && mode !== "smoke");

  const origin = String(body?.origin || url.origin).replace(/\/$/, "");
  const query = String(
    body?.query || env?.HEALTHCHECK_QUERY || DEFAULT_HEALTHCHECK_QUERY
  ).trim();
  const snapshotPlaceId = String(
    body?.snapshotPlaceId ||
      env?.HEALTHCHECK_SNAPSHOT_PLACE_ID ||
      DEFAULT_HEALTHCHECK_SNAPSHOT_PLACE_ID
  ).trim();
  const alertEmail = String(
    body?.alertEmail || env?.HEALTH_ALERT_EMAIL || "contact@getflowmetric.com"
  ).trim();

  const previous = await readJson(env?.KV, HEALTH_LAST_KEY, null);
  const rawResult = await runHealthChecks({
    origin,
    query,
    snapshotPlaceId,
  });
  const result = withFailureStreaks(rawResult, previous);
  const summary = {
    ...result,
    mode,
  };

  await writeJson(env?.KV, HEALTH_LAST_KEY, summary);
  await appendHistory(env?.KV, summary);

  const alertSummary = summarizeHealthResult(summary);
  let alert = {
    attempted: false,
    sent: false,
    skippedReason: "notifications disabled",
  };

  if (notifyRequested && shouldAlertFromHealthResult(summary)) {
    const lastAlert = await readJson(env?.KV, HEALTH_ALERT_KEY, null);

    if (shouldSendAlert({ summary: { ...summary, ...alertSummary }, lastAlert })) {
      alert.attempted = true;
      const email = buildAlertEmail({
        summary: { ...summary, ...alertSummary },
        origin,
        mode,
      });
      const sent = await sendEmailNotification({
        env,
        to: alertEmail,
        ...email,
      });

      if (sent.ok) {
        alert.sent = true;
        alert.skippedReason = null;
        await writeJson(env?.KV, HEALTH_ALERT_KEY, {
          sentAt: new Date().toISOString(),
          signature: alertSummary.alertableChecks
            .map((check) => `${check.name}:${check.code || check.httpStatus}`)
            .sort()
            .join("|"),
          checks: alertSummary.alertableChecks.map((check) => check.name),
        });
      } else {
        alert.sent = false;
        alert.skippedReason = sent.reason || sent.message || "ALERT_SEND_FAILED";
      }
    } else {
      alert.attempted = false;
      alert.sent = false;
      alert.skippedReason = "ALERT_THROTTLED";
    }
  }

  return jsonResponse({
    ...summary,
    alertableChecks: alertSummary.alertableChecks.map((check) => ({
      name: check.name,
      code: check.code,
      httpStatus: check.httpStatus,
      consecutiveFailures: check.consecutiveFailures,
      upstreamStatus: check.upstreamStatus,
      message: check.message,
    })),
    alert,
  });
}

