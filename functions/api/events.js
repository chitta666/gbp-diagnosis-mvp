const ALLOWED_EVENTS = new Set([
  "diagnosis_completed",
  "recommended_competitor_shown",
  "competitor_picker_opened",
  "competitor_picker_closed",
  "manual_competitor_selected",
  "recommended_competitor_reset",
  "searched_competitor_selected",
  "competitor_report_updated",
  "pro_interest_cta_clicked",
  "pro_interest_feedback_submitted",
]);

const ALLOWED_PAGES = new Set(["home", "report", "saved_report", "unknown"]);
const ALLOWED_LANGUAGES = new Set(["en", "ja"]);
const ALLOWED_SOURCES = new Set([
  "candidate",
  "diagnose",
  "manual",
  "recommended",
  "reset",
  "saved",
  "saved_plan",
  "feedback_modal",
  "search",
  "unknown",
]);

const ALLOWED_FEEDBACK_TYPES = new Set([
  "useful_result",
  "confusing_output",
  "bug_report",
  "missing_feature",
  "other",
  "unknown",
]);

const MAX_BODY_BYTES = 4096;
const EVENT_RETENTION_SECONDS = 60 * 60 * 24 * 30;

function jsonResponse(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

function allowedValue(value, allowed, fallback = "unknown") {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function sanitizedId(value) {
  const raw = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(raw)) return null;
  return raw;
}

function sanitizedPath(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/")) return "/";

  // Keep only the path. Query strings can contain user-entered search text.
  return raw.split("?")[0].split("#")[0].slice(0, 120) || "/";
}

function optionalBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function clampedInteger(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function compactToken(value, max = 60) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, max);
}

function buildEventRecord(body, now) {
  const event = String(body?.event || "").trim();
  if (!ALLOWED_EVENTS.has(event)) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "EVENT_NOT_ALLOWED" },
    };
  }

  return {
    ok: true,
    record: {
      event,
      flowId: sanitizedId(body?.flowId),
      page: allowedValue(body?.page, ALLOWED_PAGES),
      lang: allowedValue(body?.lang, ALLOWED_LANGUAGES, "en"),
      source: allowedValue(body?.source, ALLOWED_SOURCES),
      path: sanitizedPath(body?.path),
      candidateCount: clampedInteger(body?.candidateCount, 0, 10),
      savedListingCount: clampedInteger(body?.savedListingCount, 0, 100),
      savedListingLimit: clampedInteger(body?.savedListingLimit, 0, 100),
      freeLimitReached: optionalBoolean(body?.freeLimitReached),
      intent: compactToken(body?.intent, 40) || null,
      feedbackType: allowedValue(body?.feedbackType, ALLOWED_FEEDBACK_TYPES),
      hasFeedbackEmail: optionalBoolean(body?.hasFeedbackEmail),
      hasPlaceId: Boolean(body?.hasPlaceId),
      hasRecommendedCompetitor: Boolean(body?.hasRecommendedCompetitor),
      hasSelectedCompetitor: Boolean(body?.hasSelectedCompetitor),
      sameAsRecommended: optionalBoolean(body?.sameAsRecommended),
      createdAt: now.toISOString(),
    },
  };
}

function eventKey(now) {
  const day = now.toISOString().slice(0, 10);
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `event:${day}:${id}`;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-app-lang",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "PAYLOAD_TOO_LARGE" }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const now = new Date();
  const built = buildEventRecord(body, now);
  if (!built.ok) {
    return jsonResponse(built.body, built.status);
  }

  const KV = env?.KV;
  if (!KV) {
    return jsonResponse({ ok: true, stored: false, reason: "NO_KV_BINDING" }, 202);
  }

  try {
    await KV.put(eventKey(now), JSON.stringify(built.record), {
      expirationTtl: EVENT_RETENTION_SECONDS,
    });
  } catch (error) {
    console.error("event tracking failed", error);
    return jsonResponse({ ok: false, error: "EVENT_STORE_FAILED" }, 500);
  }

  return jsonResponse({ ok: true, stored: true });
}
