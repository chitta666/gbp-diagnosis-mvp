const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const RECENT_LIMIT = 50;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "authorization, x-feedback-admin-token",
    },
  });
}

function safeJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function authToken(request) {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();

  const direct = request.headers.get("x-feedback-admin-token");
  return direct ? direct.trim() : "";
}

function clampedInteger(value, { min = 1, max, fallback }) {
  if (value == null || String(value).trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeFilter(value) {
  return String(value || "").trim().toLowerCase();
}

function increment(map, key) {
  const normalized = String(key || "unknown").trim() || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

function dayPrefixes(days, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    return `event:${utcDay(date)}:`;
  });
}

function matchesFilters(record, filters) {
  if (filters.event && record.event !== filters.event) return false;
  if (filters.source && record.source !== filters.source) return false;
  if (filters.intent && record.intent !== filters.intent) return false;
  return true;
}

async function listEventKeys(KV, prefix, remaining) {
  const keys = [];
  let cursor = undefined;

  while (keys.length < remaining) {
    const page = await KV.list({
      prefix,
      cursor,
      limit: Math.min(1000, remaining - keys.length),
    });

    keys.push(...(Array.isArray(page?.keys) ? page.keys.map((key) => key.name).filter(Boolean) : []));

    if (page?.list_complete !== false || !page?.cursor) break;
    cursor = page.cursor;
  }

  return keys;
}

async function readEventRecords(KV, { days, limit }) {
  if (typeof KV?.list !== "function") {
    throw new Error("KV_LIST_NOT_AVAILABLE");
  }

  const records = [];
  const prefixes = dayPrefixes(days);

  for (const prefix of prefixes) {
    if (records.length >= limit) break;

    const keys = await listEventKeys(KV, prefix, limit - records.length);
    for (const key of keys) {
      if (records.length >= limit) break;
      const raw = await KV.get(key);
      const record = safeJson(raw, null);
      if (record?.event && record?.createdAt) records.push(record);
    }
  }

  return records;
}

function buildCounts(records) {
  const byEvent = {};
  const bySource = {};
  const byIntent = {};
  const byPage = {};
  const byLang = {};

  for (const record of records) {
    increment(byEvent, record.event);
    increment(bySource, record.source);
    increment(byIntent, record.intent);
    increment(byPage, record.page);
    increment(byLang, record.lang);
  }

  return { byEvent, bySource, byIntent, byPage, byLang };
}

function ratio(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function buildBenchmarkFunnel(records) {
  const counts = buildCounts(records).byEvent;
  const betaClicked = counts.beta_benchmark_feedback_clicked || 0;
  const betaSubmitted = counts.beta_benchmark_feedback_submitted || 0;
  const reportClicked = counts.report_benchmark_feedback_clicked || 0;
  const reportSubmitted = counts.report_benchmark_feedback_submitted || 0;
  const totalClicked = betaClicked + reportClicked;
  const totalSubmitted = betaSubmitted + reportSubmitted;

  return {
    beta: {
      clicked: betaClicked,
      submitted: betaSubmitted,
      submittedPerClick: ratio(betaSubmitted, betaClicked),
    },
    report: {
      clicked: reportClicked,
      submitted: reportSubmitted,
      submittedPerClick: ratio(reportSubmitted, reportClicked),
    },
    total: {
      clicked: totalClicked,
      submitted: totalSubmitted,
      submittedPerClick: ratio(totalSubmitted, totalClicked),
    },
  };
}

function compactRecord(record) {
  return {
    event: record.event,
    createdAt: record.createdAt,
    page: record.page || "unknown",
    lang: record.lang || "unknown",
    source: record.source || "unknown",
    intent: record.intent || null,
    feedbackType: record.feedbackType || null,
    hasFeedbackEmail: record.hasFeedbackEmail ?? null,
    hasSavedListing: record.hasSavedListing ?? null,
    hasCompetitor: record.hasCompetitor ?? null,
  };
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, x-feedback-admin-token",
      },
    });
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const secret = env?.FEEDBACK_ADMIN_TOKEN || "";
  if (!secret) {
    return jsonResponse({ ok: false, error: "FEEDBACK_ADMIN_TOKEN_NOT_CONFIGURED" }, 500);
  }

  if (authToken(request) !== secret) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const KV = env?.KV;
  if (!KV) {
    return jsonResponse({ ok: false, error: "NO_KV_BINDING" }, 500);
  }

  const url = new URL(request.url);
  const days = clampedInteger(url.searchParams.get("days"), {
    max: MAX_DAYS,
    fallback: DEFAULT_DAYS,
  });
  const limit = clampedInteger(url.searchParams.get("limit"), {
    max: MAX_LIMIT,
    fallback: DEFAULT_LIMIT,
  });
  const filters = {
    event: normalizeFilter(url.searchParams.get("event")),
    source: normalizeFilter(url.searchParams.get("source")),
    intent: normalizeFilter(url.searchParams.get("intent")),
  };

  let rawRecords = [];
  try {
    rawRecords = await readEventRecords(KV, { days, limit });
  } catch (error) {
    const message = error?.message || String(error);
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const filtered = rawRecords.filter((record) => matchesFilters(record, filters));
  const recent = [...filtered]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, RECENT_LIMIT)
    .map(compactRecord);

  return jsonResponse({
    ok: true,
    days,
    limit,
    filters,
    scanned: rawRecords.length,
    returned: filtered.length,
    counts: buildCounts(filtered),
    benchmarkFunnel: buildBenchmarkFunnel(filtered),
    recent,
  });
}
