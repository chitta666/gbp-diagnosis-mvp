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
      const [rawLabel, ...rest] = line.split(":");
      if (!rest.length) return;
      const label = rawLabel.trim().toLowerCase();
      const key = labelMap.get(label) || labelMap.get(rawLabel.trim());
      if (!key) return;
      fields[key] = compactText(rest.join(":").trim(), 300);
    });

  return fields;
}

function summarizeRecord(record) {
  const context = record?.context || {};
  const isBenchmark =
    record?.tags?.includes("value_benchmark") ||
    ["beta_value_benchmark", "report_value_benchmark"].includes(context.intent);

  return {
    id: record.id,
    createdAt: record.createdAt,
    type: record.type,
    status: record.status || "new",
    tags: Array.isArray(record.tags) ? record.tags : [],
    intent: context.intent || null,
    message: compactText(record.message, 700),
    benchmark: isBenchmark ? parseBenchmarkFields(record.message) : null,
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
    recent: filtered.map(summarizeRecord),
  });
}
