import { fetchPlaceDetails } from "./place.js";

const SAVED_INDEX_KEY = "saved:index";

function safeJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

async function readIdList(KV, key) {
  const raw = await KV.get(key);
  const list = safeJson(raw, []);
  return Array.isArray(list) ? list : [];
}

async function writeIdList(KV, key, ids) {
  await KV.put(key, JSON.stringify(uniq(ids)));
}

function savedKey(id) {
  return `saved:${id}`;
}

function emailKey(email) {
  return `saved:email:${normalizeEmail(email)}`;
}

function dedupeKey(email, placeId) {
  return `saved:dedupe:${normalizeEmail(email)}:${String(placeId || "").trim()}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function buildDeepLink({ origin, id }) {
  const cleanOrigin = String(origin || "").replace(/\/$/, "");
  return `${cleanOrigin}/?saved=${encodeURIComponent(id)}`;
}

export function publicSavedListing(record, { origin, includeEmail = false } = {}) {
  if (!record) return null;

  const changeSummary = buildSavedListingChangeSummary(record);
  const statusSummary = buildSavedListingStatusSummary(record, changeSummary);
  const ratingMilestoneProgress = buildRatingMilestoneProgress(record);

  const view = {
    id: record.id,
    placeId: record.placeId,
    competitorPlaceId: record.competitorPlaceId ?? null,
    competitorName: record.competitorName ?? null,
    competitorAddress: record.competitorAddress ?? null,
    q: record.q ?? null,
    name: record.name ?? null,
    address: record.address ?? null,
    status: record.status ?? "active",
    notificationFrequency: record.notificationFrequency ?? "weekly",
    timezone: record.timezone ?? "UTC",
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    lastDailyRunAt: record.lastDailyRunAt ?? null,
    lastWeeklySentAt: record.lastWeeklySentAt ?? null,
    lastCheckedAt: record.lastCheckedAt ?? record.latestMetrics?.capturedAt ?? null,
    changeSummary,
    statusSummary,
    ratingMilestoneProgress,
  };

  if (origin) {
    view.deepLink = buildDeepLink({ origin, id: record.id });
  }

  if (includeEmail) {
    view.email = record.email ?? null;
  }

  return view;
}

export async function getSavedListing(KV, id) {
  if (!id) return null;
  const raw = await KV.get(savedKey(id));
  if (!raw) return null;
  return safeJson(raw);
}

export async function patchSavedListing({ KV, id, patch }) {
  const current = await getSavedListing(KV, id);
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await KV.put(savedKey(id), JSON.stringify(next));
  return next;
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function formatSignedNumber(value, digits = 0) {
  if (!Number.isFinite(value) || value === 0) return "unchanged";
  const abs = Math.abs(value);
  const rounded =
    digits > 0
      ? (Math.round(abs * 10 ** digits) / 10 ** digits).toFixed(digits)
      : String(Math.round(abs));
  return `${value > 0 ? "+" : "-"}${rounded}`;
}

function buildMetricLine(label, previousValue, currentValue, digits = 0) {
  if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return `${label} unavailable`;
  }

  const delta = currentValue - previousValue;
  return `${label} ${formatSignedNumber(delta, digits)}`;
}

function formatSummaryDate(value) {
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return null;

  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const RATING_MILESTONE_NOTE =
  "Estimate based on current displayed rating and total reviews";

function toSingleDecimal(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(Number(value) * 10) / 10;
}

function hasPreviousSavedMetrics(record) {
  const latestCapturedAt = record?.latestMetrics?.capturedAt ?? null;
  const previousCapturedAt = record?.previousMetrics?.capturedAt ?? null;

  if (!latestCapturedAt || !previousCapturedAt) return false;
  return String(latestCapturedAt) !== String(previousCapturedAt);
}

function milestoneDisplayThreshold(milestone) {
  if (!Number.isFinite(milestone)) return null;
  return Math.round((Number(milestone) - 0.05) * 100) / 100;
}

function nextDisplayRatingMilestone(rating) {
  const currentRating = toSingleDecimal(rating);
  if (!Number.isFinite(currentRating) || currentRating >= 5) return null;
  return Math.min(5, Number((currentRating + 0.1).toFixed(1)));
}

function estimateReviewsNeededForMilestone({ rating, reviewCount, milestone, futureAverage = 5 }) {
  const currentRating = toSingleDecimal(rating);
  const currentReviewCount = Number.isFinite(reviewCount) ? Number(reviewCount) : null;
  const threshold = milestoneDisplayThreshold(milestone);

  if (
    !Number.isFinite(currentRating) ||
    !Number.isFinite(currentReviewCount) ||
    currentReviewCount <= 0 ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(futureAverage) ||
    futureAverage <= threshold
  ) {
    return null;
  }

  const rawEstimate =
    (currentReviewCount * (threshold - currentRating)) / (futureAverage - threshold);
  if (!Number.isFinite(rawEstimate)) return null;

  const roundedEstimate = Math.ceil(rawEstimate);
  return roundedEstimate > 0 ? roundedEstimate : null;
}

export function buildRatingMilestoneProgress(record) {
  const latest = record?.latestMetrics ?? null;
  const latestRating = toSingleDecimal(latest?.rating);
  const latestReviewCount = Number.isFinite(latest?.reviewCount) ? Number(latest.reviewCount) : null;

  if (!Number.isFinite(latestRating)) {
    return { visible: false, reason: "missing_rating" };
  }

  if (!Number.isFinite(latestReviewCount)) {
    return { visible: false, reason: "missing_review_count" };
  }

  if (latestRating >= 5) {
    return { visible: false, reason: "top_rating_reached" };
  }

  const nextMilestone = nextDisplayRatingMilestone(latestRating);
  const estimatedFiveStarReviewsNeeded = estimateReviewsNeededForMilestone({
    rating: latestRating,
    reviewCount: latestReviewCount,
    milestone: nextMilestone,
    futureAverage: 5,
  });

  if (!Number.isFinite(estimatedFiveStarReviewsNeeded)) {
    return { visible: false, reason: "invalid_estimate" };
  }

  let previousEstimatedFiveStarReviewsNeeded = null;
  let deltaToPreviousEstimate = null;
  let trend = "tracking";
  let supportingCopy = "Tracking from your next check";

  if (hasPreviousSavedMetrics(record)) {
    previousEstimatedFiveStarReviewsNeeded = estimateReviewsNeededForMilestone({
      rating: record?.previousMetrics?.rating,
      reviewCount: record?.previousMetrics?.reviewCount,
      milestone: nextMilestone,
      futureAverage: 5,
    });

    if (Number.isFinite(previousEstimatedFiveStarReviewsNeeded)) {
      deltaToPreviousEstimate =
        estimatedFiveStarReviewsNeeded - previousEstimatedFiveStarReviewsNeeded;

      if (deltaToPreviousEstimate < 0) {
        trend = "closer";
        supportingCopy = `${Math.abs(deltaToPreviousEstimate)} fewer than last check`;
      } else if (deltaToPreviousEstimate > 0) {
        trend = "farther";
        supportingCopy = `${deltaToPreviousEstimate} more than last check`;
      } else {
        trend = "unchanged";
        supportingCopy = "Unchanged since last check";
      }
    }
  }

  return {
    visible: true,
    nextMilestone,
    threshold: milestoneDisplayThreshold(nextMilestone),
    currentRating: latestRating,
    currentReviewCount: latestReviewCount,
    estimatedFiveStarReviewsNeeded,
    previousEstimatedFiveStarReviewsNeeded,
    deltaToPreviousEstimate,
    trend,
    supportingCopy,
    note: RATING_MILESTONE_NOTE,
  };
}

export function buildSavedListingChangeSummary(record) {
  const latest = record?.latestMetrics ?? null;
  const previous = record?.previousMetrics ?? latest;
  const freshnessDate = formatSummaryDate(record?.lastCheckedAt ?? latest?.capturedAt);

  if (!latest) {
    return {
      status: "pending",
      hasChange: false,
      lines: ["Tracking changes from your next check"],
    };
  }

  const reviewDelta =
    Number.isFinite(previous?.reviewCount) && Number.isFinite(latest?.reviewCount)
      ? latest.reviewCount - previous.reviewCount
      : null;
  const ratingDelta =
    Number.isFinite(previous?.rating) && Number.isFinite(latest?.rating)
      ? Math.round((latest.rating - previous.rating) * 10) / 10
      : null;
  const photoDelta =
    Number.isFinite(previous?.photoCount) && Number.isFinite(latest?.photoCount)
      ? latest.photoCount - previous.photoCount
      : null;

  const hasChange = [reviewDelta, ratingDelta, photoDelta].some(
    (value) => Number.isFinite(value) && value !== 0
  );

  if (!hasChange) {
    return {
      status: "unchanged",
      hasChange: false,
      lines: [
        freshnessDate
          ? `No major change since ${freshnessDate}`
          : "No major change since last check",
      ],
    };
  }

  return {
    status: "changed",
    hasChange: true,
    lines: [
      buildMetricLine("Reviews", previous?.reviewCount, latest?.reviewCount),
      buildMetricLine("Rating", previous?.rating, latest?.rating, 1),
      buildMetricLine("Photos", previous?.photoCount, latest?.photoCount),
    ],
  };
}

function buildStatusSummary(label, tone, reason) {
  return {
    label,
    tone,
    reason,
  };
}

export function buildSavedListingStatusSummary(record, changeSummary = null) {
  const latest = record?.latestMetrics ?? null;
  const previous = record?.previousMetrics ?? latest;
  const summary = changeSummary ?? buildSavedListingChangeSummary(record);
  const missing = Array.isArray(record?.analysisMissing) ? record.analysisMissing : [];
  const ratingDelta =
    Number.isFinite(previous?.rating) && Number.isFinite(latest?.rating)
      ? Math.round((latest.rating - previous.rating) * 10) / 10
      : null;
  const reviewDelta =
    Number.isFinite(previous?.reviewCount) && Number.isFinite(latest?.reviewCount)
      ? latest.reviewCount - previous.reviewCount
      : null;
  const photoDelta =
    Number.isFinite(previous?.photoCount) && Number.isFinite(latest?.photoCount)
      ? latest.photoCount - previous.photoCount
      : null;

  if (!latest) {
    return buildStatusSummary("Tracking", "quiet", "Waiting for the first saved snapshot");
  }

  if (Number.isFinite(ratingDelta) && ratingDelta < 0) {
    return buildStatusSummary(
      "Needs attention",
      "warning",
      `Rating ${formatSignedNumber(ratingDelta, 1)} since last check`
    );
  }

  if (missing.includes("website")) {
    return buildStatusSummary("Needs attention", "warning", "Website missing");
  }

  if (missing.includes("phone")) {
    return buildStatusSummary("Needs attention", "warning", "Phone missing");
  }

  if (Number.isFinite(record?.analysisScore) && record.analysisScore < 80) {
    return buildStatusSummary("Needs attention", "warning", "Profile completeness is weak");
  }

  if (Number.isFinite(record?.compareTotalDiff) && record.compareTotalDiff < 0) {
    return buildStatusSummary(
      "Opportunity",
      "accent",
      `Trail competitor by ${Math.abs(record.compareTotalDiff)} reviews`
    );
  }

  if (
    Number.isFinite(record?.compareDeltaDiff) &&
    record.compareDeltaDiff < 0 &&
    (!Number.isFinite(record?.compareTotalDiff) || record.compareTotalDiff <= 0)
  ) {
    return buildStatusSummary(
      "Opportunity",
      "accent",
      "Competitor review momentum is stronger"
    );
  }

  if (Number.isFinite(record?.photoMissingCount) && record.photoMissingCount > 0) {
    return buildStatusSummary(
      "Opportunity",
      "accent",
      record.photoMissingCount >= 8
        ? "Photo coverage trails nearby listings"
        : `Add about ${record.photoMissingCount} more photos`
    );
  }

  if (Number.isFinite(reviewDelta) && reviewDelta > 0) {
    return buildStatusSummary(
      "Opportunity",
      "accent",
      `Reviews ${formatSignedNumber(reviewDelta)} since last check`
    );
  }

  if (Number.isFinite(photoDelta) && photoDelta > 0) {
    return buildStatusSummary(
      "Opportunity",
      "accent",
      `Photos ${formatSignedNumber(photoDelta)} since last check`
    );
  }

  if (summary?.status === "unchanged") {
    return buildStatusSummary("Stable", "quiet", "No urgent changes detected");
  }

  return buildStatusSummary("Opportunity", "accent", "Worth another look");
}

export function buildSavedListingMetrics(details) {
  return {
    reviewCount: toNumberOrNull(details?.user_ratings_total),
    rating: toNumberOrNull(details?.rating),
    photoCount: Array.isArray(details?.photos) ? details.photos.length : null,
    capturedAt: new Date().toISOString(),
  };
}

export async function refreshSavedListingMetrics({ KV, key, id, listing }) {
  const current = listing ?? (id ? await getSavedListing(KV, id) : null);
  if (!current?.placeId || !key) {
    return current;
  }

  const details = await fetchPlaceDetails({
    key,
    placeId: current.placeId,
  });

  if (!details?.ok) {
    return current;
  }

  const nextMetrics = buildSavedListingMetrics(details);
  const patch = {
    previousMetrics: current.latestMetrics ?? nextMetrics,
    latestMetrics: nextMetrics,
    lastCheckedAt: nextMetrics.capturedAt,
  };

  return patchSavedListing({
    KV,
    id: current.id,
    patch,
  });
}

export async function upsertSavedListing({ KV, payload }) {
  const email = normalizeEmail(payload.email);
  const placeId = String(payload.placeId || "").trim();
  const competitorPlaceId = String(payload.competitorPlaceId || "").trim();
  const now = new Date().toISOString();

  if (!email || !placeId) {
    throw new Error("email and placeId are required");
  }

  const existingId = await KV.get(dedupeKey(email, placeId));
  const existing = existingId ? await getSavedListing(KV, existingId) : null;
  const id = existing?.id ?? crypto.randomUUID();

  const record = {
    id,
    email,
    placeId,
    competitorPlaceId: competitorPlaceId || existing?.competitorPlaceId || null,
    competitorName:
      String(payload.competitorName || existing?.competitorName || "").trim() || null,
    competitorAddress:
      String(payload.competitorAddress || existing?.competitorAddress || "").trim() || null,
    q: String(payload.q || existing?.q || "").trim() || null,
    name: String(payload.name || existing?.name || "").trim() || null,
    address: String(payload.address || existing?.address || "").trim() || null,
    timezone: String(payload.timezone || existing?.timezone || "UTC").trim() || "UTC",
    notificationFrequency: "weekly",
    status: "active",
    analysisScore: Number.isFinite(payload.analysisScore)
      ? Number(payload.analysisScore)
      : existing?.analysisScore ?? null,
    analysisMissing: Array.isArray(payload.analysisMissing)
      ? payload.analysisMissing.filter(Boolean)
      : existing?.analysisMissing ?? [],
    compareTotalDiff: Number.isFinite(payload.compareTotalDiff)
      ? Number(payload.compareTotalDiff)
      : existing?.compareTotalDiff ?? null,
    compareDeltaDiff: Number.isFinite(payload.compareDeltaDiff)
      ? Number(payload.compareDeltaDiff)
      : existing?.compareDeltaDiff ?? null,
    photoMissingCount: Number.isFinite(payload.photoMissingCount)
      ? Number(payload.photoMissingCount)
      : existing?.photoMissingCount ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastDailyRunAt: existing?.lastDailyRunAt ?? null,
    lastWeeklySentAt: existing?.lastWeeklySentAt ?? null,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    previousMetrics: existing?.previousMetrics ?? null,
    latestMetrics: existing?.latestMetrics ?? null,
  };

  await KV.put(savedKey(id), JSON.stringify(record));
  await KV.put(dedupeKey(email, placeId), id);

  const globalIds = await readIdList(KV, SAVED_INDEX_KEY);
  await writeIdList(KV, SAVED_INDEX_KEY, [...globalIds, id]);

  const emailIds = await readIdList(KV, emailKey(email));
  await writeIdList(KV, emailKey(email), [...emailIds, id]);

  return record;
}

export async function listSavedListingsByEmail({ KV, email }) {
  const normalizedEmail = normalizeEmail(email);
  const ids = await readIdList(KV, emailKey(normalizedEmail));
  const records = await Promise.all(ids.map((id) => getSavedListing(KV, id)));

  return records
    .filter((item) => item?.status !== "deleted")
    .sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
}

export async function listAllSavedListings({ KV }) {
  const ids = await readIdList(KV, SAVED_INDEX_KEY);
  const records = await Promise.all(ids.map((id) => getSavedListing(KV, id)));

  return records.filter((item) => item?.status !== "deleted");
}

export async function deleteSavedListing({ KV, id, email }) {
  const record = await getSavedListing(KV, id);
  if (!record) return { ok: false, code: "NOT_FOUND" };

  const normalizedEmail = normalizeEmail(email);
  if (record.email !== normalizedEmail) {
    return { ok: false, code: "FORBIDDEN" };
  }

  await KV.delete(savedKey(id));
  await KV.delete(dedupeKey(record.email, record.placeId));

  const globalIds = await readIdList(KV, SAVED_INDEX_KEY);
  await writeIdList(
    KV,
    SAVED_INDEX_KEY,
    globalIds.filter((item) => item !== id)
  );

  const emailIds = await readIdList(KV, emailKey(record.email));
  await writeIdList(
    KV,
    emailKey(record.email),
    emailIds.filter((item) => item !== id)
  );

  return { ok: true, record };
}
