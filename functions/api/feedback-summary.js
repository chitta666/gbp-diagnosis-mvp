const FEEDBACK_INDEX_KEY = "feedback:index";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

function clampedLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.round(number)));
}

function compactText(value, max = 240) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function maskEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return null;
  const [local, domain] = clean.split("@");
  const first = local.slice(0, 1) || "*";
  return `${first}${local.length > 1 ? "***" : "*"}@${domain}`;
}

function increment(map, key) {
  const normalized = String(key || "unknown").trim() || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function normalizeFilter(value) {
  return String(value || "").trim();
}

function matchesFilters(record, filters) {
  if (filters.tag && !record.tags?.includes(filters.tag)) return false;
  if (filters.intent && record.context?.intent !== filters.intent) return false;
  if (filters.type && record.type !== filters.type) return false;
  return true;
}

function parseBenchmarkFields(message) {
  const fields = {};
  const labelMap = new Map([
    ["usual prep time", "usualPrepTime"],
    ["普段の下準備時間", "usualPrepTime"],
    ["flowmetric time", "flowmetricTime"],
    ["flowmetricでの作成時間", "flowmetricTime"],
    ["estimated minutes saved", "estimatedMinutesSaved"],
    ["削減できた目安", "estimatedMinutesSaved"],
    ["reusable client sentence", "reusableClientSentence"],
    ["そのまま使えた一文", "reusableClientSentence"],
    ["what still needed rewriting", "rewriteNeeds"],
    ["書き直した箇所", "rewriteNeeds"],
    ["what i did not trust yet", "trustGaps"],
    ["まだ信頼しきれなかった点", "trustGaps"],
  ]);

  String(message || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^([^:：]+)[:：](.*)$/);
      if (!match) return;
      const rawLabel = match[1];
      const label = rawLabel.trim().toLowerCase();
      const key = labelMap.get(label) || labelMap.get(rawLabel.trim());
      if (!key) return;
      fields[key] = compactText(match[2].trim(), 300);
    });

  return fields;
}

function isBenchmarkRecord(record) {
  const context = record?.context || {};
  return (
    record?.tags?.includes("value_benchmark") ||
    ["beta_value_benchmark", "report_value_benchmark"].includes(context.intent)
  );
}

function parseMinutes(value) {
  const text = String(value || "").trim().toLowerCase().replace(/,/g, "");
  if (!text) return null;

  let total = 0;
  let matchedUnit = false;
  const hourPattern = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|時間)/g;
  const minutePattern = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|分)/g;

  for (const match of text.matchAll(hourPattern)) {
    total += Number(match[1]) * 60;
    matchedUnit = true;
  }

  for (const match of text.matchAll(minutePattern)) {
    total += Number(match[1]);
    matchedUnit = true;
  }

  if (matchedUnit) return roundNumber(total);

  const firstNumber = text.match(/(\d+(?:\.\d+)?)/);
  return firstNumber ? roundNumber(Number(firstNumber[1])) : null;
}

function numberStats(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!cleanValues.length) {
    return {
      count: 0,
      total: 0,
      average: null,
      median: null,
      min: null,
      max: null,
    };
  }

  const total = cleanValues.reduce((sum, value) => sum + value, 0);
  const middle = Math.floor(cleanValues.length / 2);
  const median =
    cleanValues.length % 2 === 0
      ? (cleanValues[middle - 1] + cleanValues[middle]) / 2
      : cleanValues[middle];

  return {
    count: cleanValues.length,
    total: roundNumber(total),
    average: roundNumber(total / cleanValues.length),
    median: roundNumber(median),
    min: roundNumber(cleanValues[0]),
    max: roundNumber(cleanValues[cleanValues.length - 1]),
  };
}

function buildBenchmarkStats(records) {
  const minutesSavedValues = [];
  const stats = {
    records: 0,
    withUsualPrepTime: 0,
    withFlowmetricTime: 0,
    withEstimatedMinutesSaved: 0,
    withReusableClientSentence: 0,
    withRewriteNeeds: 0,
    withTrustGaps: 0,
  };

  for (const record of records) {
    if (!isBenchmarkRecord(record)) continue;
    stats.records += 1;

    const fields = parseBenchmarkFields(record.message);
    const usualPrepTime = parseMinutes(fields.usualPrepTime);
    const flowmetricTime = parseMinutes(fields.flowmetricTime);
    const explicitMinutesSaved = parseMinutes(fields.estimatedMinutesSaved);
    const derivedMinutesSaved =
      explicitMinutesSaved == null && usualPrepTime != null && flowmetricTime != null
        ? Math.max(0, usualPrepTime - flowmetricTime)
        : null;
    const minutesSaved = explicitMinutesSaved ?? derivedMinutesSaved;

    if (usualPrepTime != null) stats.withUsualPrepTime += 1;
    if (flowmetricTime != null) stats.withFlowmetricTime += 1;
    if (minutesSaved != null) {
      stats.withEstimatedMinutesSaved += 1;
      minutesSavedValues.push(minutesSaved);
    }
    if (fields.reusableClientSentence) stats.withReusableClientSentence += 1;
    if (fields.rewriteNeeds) stats.withRewriteNeeds += 1;
    if (fields.trustGaps) stats.withTrustGaps += 1;
  }

  return {
    ...stats,
    estimatedMinutesSaved: numberStats(minutesSavedValues),
  };
}

function summarizeRecord(record) {
  const context = record?.context || {};

  return {
    id: record.id,
    createdAt: record.createdAt,
    type: record.type,
    status: record.status || "new",
    tags: Array.isArray(record.tags) ? record.tags : [],
    intent: context.intent || null,
    message: compactText(record.message, 700),
    benchmark: isBenchmarkRecord(record) ? parseBenchmarkFields(record.message) : null,
    email: maskEmail(record.email),
    context: {
      page: context.page || null,
      placeName: context.placeName || null,
      competitorName: context.competitorName || null,
      savedListingId: context.savedListingId || null,
      path: context.path || null,
      reportGeneratedAt: context.reportGeneratedAt || null,
    },
  };
}

async function readFeedbackRecords(KV, ids, scanLimit) {
  const records = [];
  for (const id of ids.slice(0, Math.min(ids.length, scanLimit))) {
    const raw = await KV.get(`feedback:${id}`);
    const record = safeJson(raw, null);
    if (record?.id) records.push(record);
  }
  return records;
}

function buildCounts(records) {
  const byType = {};
  const byIntent = {};
  const byTag = {};

  for (const record of records) {
    increment(byType, record.type);
    increment(byIntent, record.context?.intent);
    (Array.isArray(record.tags) ? record.tags : []).forEach((tag) => increment(byTag, tag));
  }

  return { byType, byIntent, byTag };
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
  const filters = {
    tag: normalizeFilter(url.searchParams.get("tag")),
    intent: normalizeFilter(url.searchParams.get("intent")),
    type: normalizeFilter(url.searchParams.get("type")),
  };
  const limit = clampedLimit(url.searchParams.get("limit"));
  const index = safeJson(await KV.get(FEEDBACK_INDEX_KEY), []);
  const ids = Array.isArray(index) ? index : [];
  const hasFilters = Boolean(filters.tag || filters.intent || filters.type);
  const scanLimit = hasFilters ? Math.min(ids.length, Math.max(limit * 5, DEFAULT_LIMIT)) : limit;
  const rawRecords = await readFeedbackRecords(KV, ids, scanLimit);
  const filtered = rawRecords.filter((record) => matchesFilters(record, filters)).slice(0, limit);

  return jsonResponse({
    ok: true,
    filters,
    limit,
    totalIndexed: ids.length,
    scanLimit,
    scanned: rawRecords.length,
    returned: filtered.length,
    counts: buildCounts(filtered),
    benchmarkStats: buildBenchmarkStats(filtered),
    recent: filtered.map(summarizeRecord),
  });
}
