import { ymdTokyo } from "./date.js";
import { fetchPlaceDetails } from "./place.js";
import { buildReviewClues } from "./reviewClues.js";

const SAVED_INDEX_KEY = "saved:index";
const REVIEW_THEME_HISTORY_LIMIT = 12;

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

function compactStringList(values, limit = 2) {
  return uniq(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ).slice(0, limit);
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
  const reviewDropSignal = buildReviewDropSignal(record);
  const reviewThemeMonitoring = buildReviewThemeMonitoringSummary(record);
  const statusSummary = buildSavedListingStatusSummary(
    record,
    changeSummary,
    reviewDropSignal
  );
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
    reviewDropSignal,
    reviewThemeMonitoring,
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

function normalizedReviewThemeHistory(history) {
  return {
    own: Array.isArray(history?.own) ? history.own.filter(Boolean) : [],
    competitor: Array.isArray(history?.competitor) ? history.competitor.filter(Boolean) : [],
  };
}

function snapshotDayKey(capturedAt) {
  const ts = Date.parse(String(capturedAt || ""));
  return Number.isFinite(ts) ? ymdTokyo(new Date(ts)) : null;
}

function reviewClueCompetitorFromDetails(details) {
  if (!details?.ok) return null;
  return {
    place_id: details.placeId ?? details.place_id ?? null,
    placeId: details.placeId ?? details.place_id ?? null,
    name: details.name ?? null,
    website: details.website ?? null,
    photos: Array.isArray(details.photos) ? details.photos : [],
    photoCount: Array.isArray(details.photos) ? details.photos.length : null,
    user_ratings_total: Number.isFinite(details.user_ratings_total)
      ? Number(details.user_ratings_total)
      : null,
  };
}

function reviewPhotoAnalysis({ details, comparedDetails }) {
  const myPhotos = Array.isArray(details?.photos) ? details.photos.length : 0;
  const comparedPhotos = Array.isArray(comparedDetails?.photos)
    ? comparedDetails.photos.length
    : myPhotos;

  return {
    myPhotos,
    competitorPhotoAvg: comparedPhotos,
    missingPhotos: Math.max(comparedPhotos - myPhotos, 0),
  };
}

export function buildStoredReviewThemeSnapshot({
  details,
  comparedDetails,
  capturedAt = new Date().toISOString(),
} = {}) {
  if (!details?.ok) return null;

  const reviewClues = buildReviewClues({
    reviews: details.reviews,
    details,
    photoAnalysis: reviewPhotoAnalysis({ details, comparedDetails }),
    competitor: reviewClueCompetitorFromDetails(comparedDetails),
  });

  if (!reviewClues?.summary || !Number.isFinite(reviewClues?.reviewCountInSample)) {
    return null;
  }

  return {
    capturedAt,
    placeId: details.placeId ?? details.place_id ?? null,
    comparedAgainstPlaceId:
      comparedDetails?.placeId ?? comparedDetails?.place_id ?? null,
    sampleBasis: reviewClues.sampleBasis ?? "recent_visible_reviews",
    sampleReviewCount: Number(reviewClues.reviewCountInSample),
    summary: String(reviewClues.summary || "").trim() || null,
    strengths: compactStringList(reviewClues.strengths),
    frictions: compactStringList(reviewClues.frictions),
    underSignaledStrengths: compactStringList(reviewClues.underSignaledStrengths),
    verificationGaps: compactStringList(reviewClues.verificationGaps),
    competitorChoiceEdges: compactStringList(reviewClues.competitorChoiceEdges),
    priorityAction: String(reviewClues.priorityAction || "").trim() || null,
    confidence: String(reviewClues.confidence || "low"),
  };
}

function mergeStoredReviewThemeHistory(history, snapshot) {
  if (!snapshot?.placeId) return Array.isArray(history) ? history : [];

  const nextDay = snapshotDayKey(snapshot.capturedAt);
  const filtered = (Array.isArray(history) ? history : []).filter((item) => {
    if (!item) return false;
    if (String(item.placeId || "") !== String(snapshot.placeId || "")) return true;
    if (
      String(item.comparedAgainstPlaceId || "") !==
      String(snapshot.comparedAgainstPlaceId || "")
    ) {
      return true;
    }
    return snapshotDayKey(item.capturedAt) !== nextDay;
  });

  return [snapshot, ...filtered]
    .sort((a, b) => String(b?.capturedAt || "").localeCompare(String(a?.capturedAt || "")))
    .slice(0, REVIEW_THEME_HISTORY_LIMIT);
}

function themeFrequency(snapshots, key) {
  const counts = new Map();
  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const values = compactStringList(snapshot?.[key], 8);
    values.forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function riskScore(snapshot) {
  if (!snapshot) return 0;
  return (
    compactStringList(snapshot.frictions, 8).length * 2 +
    compactStringList(snapshot.verificationGaps, 8).length +
    compactStringList(snapshot.competitorChoiceEdges, 8).length
  );
}

function buildCollectingReviewThemeMonitoring() {
  return {
    status: "collecting_history",
    trend: null,
    gapDirection: null,
    recurringFrictions: [],
    notableShift: "Available after two saved review-theme snapshots.",
    nextAction: "Keep monitoring until another saved review snapshot is available.",
    confidence: "low",
  };
}

function buildTrendLabel({ latest, previous, recurringFrictions }) {
  const latestScore = riskScore(latest);
  const previousScore = riskScore(previous);
  const delta = latestScore - previousScore;

  if (delta <= -2) return "improving";
  if (delta >= 2) return "worsening";
  if (recurringFrictions.length || compactStringList(latest?.verificationGaps, 8).length) {
    return "mixed";
  }
  return "steady";
}

function buildGapDirection({ latest, previous, competitorHistory }) {
  if (!Array.isArray(competitorHistory) || competitorHistory.length < 2) {
    return null;
  }

  const latestEdgeCount = compactStringList(latest?.competitorChoiceEdges, 8).length;
  const previousEdgeCount = compactStringList(previous?.competitorChoiceEdges, 8).length;

  if (latestEdgeCount < previousEdgeCount) return "narrowing";
  if (latestEdgeCount > previousEdgeCount) return "widening";
  return "unchanged";
}

function buildNotableShift({
  latest,
  previous,
  recurringFrictions,
  trend,
  gapDirection,
}) {
  const previousFrictions = new Set(compactStringList(previous?.frictions, 8));
  const latestFrictions = compactStringList(latest?.frictions, 8);

  if (recurringFrictions[0]) {
    return `${recurringFrictions[0]} is repeating across recent checks.`;
  }

  const newFriction = latestFrictions.find((item) => !previousFrictions.has(item));
  if (newFriction) {
    return `${newFriction} is appearing more clearly in the latest review snapshot.`;
  }

  if (
    compactStringList(previous?.verificationGaps, 8).length &&
    !compactStringList(latest?.verificationGaps, 8).length
  ) {
    return "Verification friction looks less central than in the previous saved check.";
  }

  if (gapDirection === "narrowing") {
    return "The selected competitor edge looks softer than it did in the previous saved check.";
  }

  if (gapDirection === "widening") {
    return "The selected competitor edge looks more persistent than it did in the previous saved check.";
  }

  if (trend === "improving") {
    return "Recent review-theme pressure looks lighter than in the previous saved check.";
  }

  if (trend === "worsening") {
    return "Recent review-theme pressure looks heavier than in the previous saved check.";
  }

  return "No major review-theme shift stands out yet.";
}

function buildTrendAwareNextAction({ latest, recurringFrictions, trend, gapDirection }) {
  if (recurringFrictions.length && latest?.priorityAction) {
    return latest.priorityAction;
  }

  if (gapDirection === "widening") {
    return "Close the easiest visible competitor proof gap before comparing momentum again.";
  }

  if (trend === "improving") {
    return "Keep the recent changes in place and watch whether the same friction stays quiet.";
  }

  return (
    String(latest?.priorityAction || "").trim() ||
    "Keep monitoring until one repeat friction becomes clear enough to prioritize."
  );
}

export function buildReviewThemeMonitoringSummary(record) {
  const history = normalizedReviewThemeHistory(record?.reviewThemeHistory);
  const ownHistory = history.own.slice(0, 4);
  const competitorHistory = history.competitor
    .filter((item) => String(item?.placeId || "") === String(record?.competitorPlaceId || ""))
    .slice(0, 4);

  if (ownHistory.length < 2) {
    return buildCollectingReviewThemeMonitoring();
  }

  const latest = ownHistory[0];
  const previous = ownHistory[1];
  const recurringFrictions = themeFrequency(ownHistory, "frictions")
    .filter((item) => item.count >= 2)
    .map((item) => item.label)
    .slice(0, 2);
  const trend = buildTrendLabel({ latest, previous, recurringFrictions });
  const gapDirection = buildGapDirection({ latest, previous, competitorHistory });
  const notableShift = buildNotableShift({
    latest,
    previous,
    recurringFrictions,
    trend,
    gapDirection,
  });
  const sampleTotal = ownHistory.reduce(
    (sum, item) => sum + (Number.isFinite(item?.sampleReviewCount) ? Number(item.sampleReviewCount) : 0),
    0
  );

  return {
    status: "ready",
    trend,
    gapDirection,
    recurringFrictions,
    notableShift,
    nextAction: buildTrendAwareNextAction({
      latest,
      recurringFrictions,
      trend,
      gapDirection,
    }),
    confidence: ownHistory.length >= 3 && sampleTotal >= 6 ? "medium" : "low",
    latestCapturedAt: latest?.capturedAt ?? null,
    previousCapturedAt: previous?.capturedAt ?? null,
  };
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
const REVIEW_DROP_ALERT_MIN = 2;

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
  let supportingCopy = "We'll compare progress again after your next check";

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

export function buildReviewDropSignal(record) {
  const latest = record?.latestMetrics ?? null;
  const previous = hasPreviousSavedMetrics(record) ? record?.previousMetrics ?? null : null;
  const latestReviewCount = Number.isFinite(latest?.reviewCount) ? Number(latest.reviewCount) : null;
  const previousReviewCount = Number.isFinite(previous?.reviewCount)
    ? Number(previous.reviewCount)
    : null;

  if (!Number.isFinite(previousReviewCount) || !Number.isFinite(latestReviewCount)) {
    return { visible: false, reason: "insufficient_history" };
  }

  const dropCount = previousReviewCount - latestReviewCount;
  if (!Number.isFinite(dropCount) || dropCount < REVIEW_DROP_ALERT_MIN) {
    return { visible: false, reason: "not_material" };
  }

  return {
    visible: true,
    tone: "warning",
    dropCount,
    previousReviewCount,
    currentReviewCount: latestReviewCount,
    reason: `Review count is down by ${dropCount} since the last saved check`,
    customerImpact: "Visible trust may be weaker than it was at the last saved check.",
    nextCheck: "Confirm whether the drop persists and whether the competitor gap changed.",
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
      lines: ["We'll compare changes after your next check"],
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

export function buildSavedListingStatusSummary(
  record,
  changeSummary = null,
  reviewDropSignal = null
) {
  const latest = record?.latestMetrics ?? null;
  const previous = record?.previousMetrics ?? latest;
  const summary = changeSummary ?? buildSavedListingChangeSummary(record);
  const reviewDrop = reviewDropSignal ?? buildReviewDropSignal(record);
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

  if (reviewDrop?.visible) {
    return buildStatusSummary("Needs attention", "warning", reviewDrop.reason);
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

export async function refreshSavedListingReviewThemeHistory({ KV, key, id, listing }) {
  const current = listing ?? (id ? await getSavedListing(KV, id) : null);
  if (!current?.placeId || !current?.competitorPlaceId || !key) {
    return current;
  }

  const [ownDetails, competitorDetails] = await Promise.all([
    fetchPlaceDetails({
      key,
      placeId: current.placeId,
    }),
    fetchPlaceDetails({
      key,
      placeId: current.competitorPlaceId,
    }),
  ]);

  if (!ownDetails?.ok || !competitorDetails?.ok) {
    return current;
  }

  const capturedAt = new Date().toISOString();
  const ownSnapshot = buildStoredReviewThemeSnapshot({
    details: ownDetails,
    comparedDetails: competitorDetails,
    capturedAt,
  });
  const competitorSnapshot = buildStoredReviewThemeSnapshot({
    details: competitorDetails,
    comparedDetails: ownDetails,
    capturedAt,
  });

  if (!ownSnapshot && !competitorSnapshot) {
    return current;
  }

  const history = normalizedReviewThemeHistory(current.reviewThemeHistory);
  const patch = {
    reviewThemeHistory: {
      own: ownSnapshot
        ? mergeStoredReviewThemeHistory(history.own, ownSnapshot)
        : history.own,
      competitor: competitorSnapshot
        ? mergeStoredReviewThemeHistory(history.competitor, competitorSnapshot)
        : history.competitor,
    },
    lastReviewThemeCapturedAt: capturedAt,
  };

  return patchSavedListing({
    KV,
    id: current.id,
    patch,
  });
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
    reviewThemeHistory: normalizedReviewThemeHistory(existing?.reviewThemeHistory),
    lastReviewThemeCapturedAt: existing?.lastReviewThemeCapturedAt ?? null,
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
