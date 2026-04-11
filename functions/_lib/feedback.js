const FEEDBACK_INDEX_KEY = "feedback:index";
const FEEDBACK_INDEX_LIMIT = 500;

const ALLOWED_FEEDBACK_TYPES = new Set([
  "useful_result",
  "confusing_output",
  "bug_report",
  "missing_feature",
  "other",
]);

function safeJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidOptionalEmail(email) {
  if (!String(email || "").trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function normalizeFeedbackType(value) {
  const type = String(value || "").trim();
  return ALLOWED_FEEDBACK_TYPES.has(type) ? type : "";
}

function compactText(value, max = 400) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function compactContext(context) {
  return {
    page: compactText(context?.page, 40) || "general",
    query: compactText(context?.query, 200) || null,
    placeId: compactText(context?.placeId, 120) || null,
    placeName: compactText(context?.placeName, 160) || null,
    competitorPlaceId: compactText(context?.competitorPlaceId, 120) || null,
    competitorName: compactText(context?.competitorName, 160) || null,
    savedListingId: compactText(context?.savedListingId, 80) || null,
    diagnosisHeadline: compactText(context?.diagnosisHeadline, 200) || null,
    path: compactText(context?.path, 120) || null,
    href: compactText(context?.href, 300) || null,
    reportGeneratedAt: compactText(context?.reportGeneratedAt, 80) || null,
  };
}

async function appendFeedbackIndex(KV, id) {
  const current = safeJson(await KV.get(FEEDBACK_INDEX_KEY), []);
  const next = [id, ...(Array.isArray(current) ? current : []).filter((item) => item !== id)].slice(
    0,
    FEEDBACK_INDEX_LIMIT
  );
  await KV.put(FEEDBACK_INDEX_KEY, JSON.stringify(next));
}

export async function saveFeedback({ KV, payload, request }) {
  const type = normalizeFeedbackType(payload?.type);
  const message = String(payload?.message || "").trim();
  const email = normalizeEmail(payload?.email);

  if (!type) {
    return {
      ok: false,
      error: "VALID_TYPE_REQUIRED",
      message: "Choose the feedback type first.",
    };
  }

  if (message.length < 5) {
    return {
      ok: false,
      error: "MESSAGE_REQUIRED",
      message: "Add a short note before sending feedback.",
    };
  }

  if (message.length > 2000) {
    return {
      ok: false,
      error: "MESSAGE_TOO_LONG",
      message: "Keep feedback under 2000 characters for now.",
    };
  }

  if (!isValidOptionalEmail(email)) {
    return {
      ok: false,
      error: "VALID_EMAIL_REQUIRED",
      message: "Use a valid email address or leave it blank.",
    };
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const record = {
    id,
    createdAt,
    type,
    message,
    email: email || null,
    context: compactContext(payload?.context),
    meta: {
      userAgent: compactText(request?.headers?.get("user-agent"), 300) || null,
    },
    status: "new",
  };

  await KV.put(`feedback:${id}`, JSON.stringify(record));
  await appendFeedbackIndex(KV, id);

  return {
    ok: true,
    id,
    createdAt,
    message: "Feedback received. Thank you.",
  };
}
