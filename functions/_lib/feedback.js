const FEEDBACK_INDEX_KEY = "feedback:index";
const FEEDBACK_INDEX_LIMIT = 500;

const ALLOWED_FEEDBACK_TYPES = new Set([
  "useful_result",
  "confusing_output",
  "bug_report",
  "missing_feature",
  "other",
]);

const FEEDBACK_TAG_RULES = [
  {
    tag: "competitor_selection",
    keywords: ["competitor", "comparison", "compare", "picker", "nearby", "nearest"],
  },
  {
    tag: "customer_choice",
    keywords: ["customer choice", "first impression", "trust signal", "visible trust"],
  },
  {
    tag: "review_support",
    keywords: ["review dispute", "suspicious review", "fake review", "public response", "community post"],
  },
  {
    tag: "review_monitoring",
    keywords: ["review monitoring", "theme trend", "competitor gap", "notable shift", "snapshot"],
  },
  {
    tag: "saved_workflow",
    keywords: ["saved listing", "saved report", "history", "revisit", "reopen"],
  },
  {
    tag: "pro_interest",
    keywords: ["pro", "upgrade", "paid", "saved limit", "client reporting"],
  },
  {
    tag: "value_benchmark",
    keywords: [
      "benchmark",
      "time saved",
      "minutes saved",
      "flowmetric time",
      "usual prep time",
      "普段の下準備時間",
      "削減できた目安",
      "作成時間",
    ],
  },
  {
    tag: "rewrite_needed",
    keywords: ["rewrite", "rewriting", "書き直し", "書き直した"],
  },
  {
    tag: "trust_gap",
    keywords: ["did not trust", "not trusted", "信頼しきれ", "信頼でき"],
  },
  {
    tag: "report_copy",
    keywords: ["headline", "summary", "wording", "copy", "readability", "confusing"],
  },
  {
    tag: "pdf_export",
    keywords: ["pdf", "export", "share", "print"],
  },
  {
    tag: "mobile_ui",
    keywords: ["mobile", "phone", "small screen", "narrow screen", "responsive"],
  },
  {
    tag: "bug_signal",
    keywords: ["bug", "broken", "error", "failed", "doesn't work", "does not work", "not working"],
  },
  {
    tag: "performance",
    keywords: ["slow", "loading", "lag", "stuck", "spinner"],
  },
  {
    tag: "feedback_intake",
    keywords: ["feedback", "quick feedback"],
  },
];

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
    savedListingCount: compactText(context?.savedListingCount, 20) || null,
    savedListingLimit: compactText(context?.savedListingLimit, 20) || null,
    freeLimitReached: Boolean(context?.freeLimitReached),
    intent: compactText(context?.intent, 40) || null,
    diagnosisHeadline: compactText(context?.diagnosisHeadline, 200) || null,
    customerChoiceSummary: compactText(context?.customerChoiceSummary, 240) || null,
    customerChoicePriorityAction: compactText(context?.customerChoicePriorityAction, 240) || null,
    reviewClueConfidence: compactText(context?.reviewClueConfidence, 40) || null,
    reviewSampleCount: compactText(context?.reviewSampleCount, 20) || null,
    path: compactText(context?.path, 120) || null,
    href: compactText(context?.href, 300) || null,
    reportGeneratedAt: compactText(context?.reportGeneratedAt, 80) || null,
  };
}

function buildFeedbackSearchText({ type, message, context }) {
  return [
    type,
    message,
    context?.page,
    context?.query,
    context?.placeName,
    context?.competitorName,
    context?.diagnosisHeadline,
    context?.customerChoiceSummary,
    context?.customerChoicePriorityAction,
    context?.intent,
    context?.path,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferFeedbackTags({ type, message, context }) {
  const tags = new Set();
  const searchText = buildFeedbackSearchText({ type, message, context });

  if (type === "bug_report") tags.add("bug_signal");
  if (type === "confusing_output") tags.add("report_copy");
  if (type === "missing_feature") tags.add("feature_gap");
  if (type === "useful_result") tags.add("positive_signal");

  if (["beta_value_benchmark", "report_value_benchmark"].includes(context?.intent)) {
    tags.add("value_benchmark");
    tags.add("time_saved");
  }

  if (context?.intent === "customer_choice_validation") {
    tags.add("customer_choice");
    tags.add("validation_signal");
  }

  if (context?.savedListingId || context?.page === "saved_listing" || String(context?.href || "").includes("saved=")) {
    tags.add("saved_workflow");
  }

  if (context?.competitorPlaceId || context?.competitorName) {
    tags.add("competitor_selection");
  }

  for (const rule of FEEDBACK_TAG_RULES) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword))) {
      tags.add(rule.tag);
    }
  }

  return Array.from(tags).sort().slice(0, 8);
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
  const context = compactContext(payload?.context);

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
    context,
    tags: inferFeedbackTags({ type, message, context }),
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
    tags: record.tags,
    message: "Feedback received. Thank you.",
  };
}
