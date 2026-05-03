import { ymdTokyo } from "./date.js";
import { fetchPlaceDetails } from "./place.js";
import { buildReviewClues } from "./reviewClues.js";
import { buildWeeklyDiffSummary } from "./weeklyDiffSummary.js";

const SAVED_INDEX_KEY = "saved:index";
const REVIEW_THEME_HISTORY_LIMIT = 12;
const ACTION_HISTORY_LIMIT = 12;
const ACTION_HISTORY_PUBLIC_LIMIT = 5;
const ACTION_STATUSES = new Set(["planned", "done", "skipped"]);
const ACTION_SOURCES = new Set(["weekly_task", "manual"]);

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

function compactText(value, limit = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function normalizeActionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ACTION_STATUSES.has(status) ? status : "planned";
}

function normalizeActionSource(value) {
  const source = String(value || "").trim().toLowerCase();
  return ACTION_SOURCES.has(source) ? source : "weekly_task";
}

function normalizeActionSnapshotContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    generatedAt: compactText(value.generatedAt, 48),
    placeName: compactText(value.placeName, 160),
    competitorName: compactText(value.competitorName, 160),
    weeklyHeadline: compactText(value.weeklyHeadline, 260),
    weeklyStatus: compactText(value.weeklyStatus, 80),
    executionWhy: compactText(value.executionWhy, 320),
    doneCriteria: compactText(value.doneCriteria, 320),
    nextCheck: compactText(value.nextCheck, 320),
  };
}

function normalizeSavedAction(action = {}, fallback = {}) {
  const now = fallback.now || new Date().toISOString();
  const label = compactText(action?.label || fallback.label, 90);
  const body = compactText(action?.body || fallback.body, 560);

  if (!label && !body) return null;

  const status = normalizeActionStatus(action?.status || fallback.status);
  const completedAt =
    status === "planned"
      ? null
      : compactText(action?.completedAt, 48) || now;
  const language = normalizeActionLanguage(action?.language || fallback.language);

  return {
    id: compactText(action?.id, 80) || crypto.randomUUID(),
    createdAt: compactText(action?.createdAt, 48) || now,
    updatedAt: compactText(action?.updatedAt, 48) || now,
    label: label || "Task",
    body: body || "",
    source: normalizeActionSource(action?.source || fallback.source),
    status,
    note: compactText(action?.note, 500),
    completedAt,
    snapshotContext: normalizeActionSnapshotContext(action?.snapshotContext),
    ...(language ? { language } : {}),
  };
}

function normalizeActionHistory(history) {
  return (Array.isArray(history) ? history : [])
    .map((item) => normalizeSavedAction(item))
    .filter(Boolean)
    .sort((a, b) =>
      String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""))
    )
    .slice(0, ACTION_HISTORY_LIMIT);
}

const STORED_THEME_LABELS = {
  friendly_staff: {
    en: "friendly staff",
    ja: "スタッフの親切さ",
  },
  atmosphere: {
    en: "the atmosphere",
    ja: "雰囲気",
  },
  quality: {
    en: "product quality",
    ja: "商品・サービスの質",
  },
  professionalism: {
    en: "professional service",
    ja: "プロらしい対応",
  },
  cleanliness: {
    en: "a clean environment",
    ja: "清潔感",
  },
  slow_service: {
    en: "slow service",
    ja: "対応の遅さ",
  },
  confusing_process: {
    en: "an unclear process",
    ja: "分かりにくい導線",
  },
  rude_service: {
    en: "unfriendly service",
    ja: "対応の悪さ",
  },
  noise_crowding: {
    en: "noise or crowding",
    ja: "騒がしさ・混雑",
  },
  overpriced: {
    en: "value concerns",
    ja: "価格への不満",
  },
};

const STORED_THEME_LOOKUP = Object.values(STORED_THEME_LABELS).reduce((acc, item) => {
  acc[String(item.en || "").toLowerCase()] = item;
  acc[String(item.ja || "").toLowerCase()] = item;
  return acc;
}, {});

function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function normalizePreferredLanguage(value, fallback = "en") {
  return isJapanese(value) ? "ja" : fallback;
}

function normalizeActionLanguage(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return isJapanese(text) ? "ja" : "en";
}

function localizedString(value, lang = "en") {
  if (!value) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }

  if (typeof value === "object") {
    const preferred = isJapanese(lang) ? value?.ja : value?.en;
    const fallback = isJapanese(lang) ? value?.en : value?.ja;
    const text = String(preferred || fallback || "").trim();
    return text || null;
  }

  return null;
}

function translateStoredThemeLabel(value, lang = "en") {
  const text = String(value || "").trim();
  if (!text) return null;

  const hit = STORED_THEME_LOOKUP[text.toLowerCase()];
  if (!hit) return text;
  return isJapanese(lang) ? hit.ja : hit.en;
}

function localizedStringList(value, lang = "en", limit = 2, { translateThemes = false } = {}) {
  let list = [];

  if (Array.isArray(value)) {
    list = value;
  } else if (value && typeof value === "object") {
    const preferred = isJapanese(lang) ? value?.ja : value?.en;
    const fallback = isJapanese(lang) ? value?.en : value?.ja;
    list =
      Array.isArray(preferred) && preferred.length
        ? preferred
        : Array.isArray(fallback)
          ? fallback
          : [];
  }

  const compacted = compactStringList(list, limit);
  return translateThemes
    ? compactStringList(compacted.map((item) => translateStoredThemeLabel(item, lang)), limit)
    : compacted;
}

function localizedPair(enValue, jaValue) {
  return {
    en: typeof enValue === "string" ? String(enValue || "").trim() || null : enValue,
    ja: typeof jaValue === "string" ? String(jaValue || "").trim() || null : jaValue,
  };
}

function localizedListPair(enValues, jaValues, limit = 2) {
  return {
    en: compactStringList(Array.isArray(enValues) ? enValues : jaValues, limit),
    ja: compactStringList(Array.isArray(jaValues) ? jaValues : enValues, limit),
  };
}

function localizeStoredSnapshot(snapshot, lang = "en") {
  if (!snapshot) return null;

  return {
    ...snapshot,
    summary: localizedString(snapshot.summary, lang),
    strengths: localizedStringList(snapshot.strengths, lang, 8, {
      translateThemes: true,
    }),
    frictions: localizedStringList(snapshot.frictions, lang, 8, {
      translateThemes: true,
    }),
    underSignaledStrengths: localizedStringList(
      snapshot.underSignaledStrengths,
      lang,
      8
    ),
    verificationGaps: localizedStringList(snapshot.verificationGaps, lang, 8),
    competitorChoiceEdges: localizedStringList(
      snapshot.competitorChoiceEdges,
      lang,
      8
    ),
    priorityAction: localizedString(snapshot.priorityAction, lang),
  };
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

export function publicSavedListing(
  record,
  { origin, includeEmail = false, lang = "en", weeklyReport = null } = {}
) {
  if (!record) return null;

  const changeSummary = buildSavedListingChangeSummary(record, { lang });
  const reviewDropSignal = buildReviewDropSignal(record, { lang });
  const reviewThemeMonitoring = buildReviewThemeMonitoringSummary(record, { lang });
  const statusSummary = buildSavedListingStatusSummary(
    record,
    changeSummary,
    reviewDropSignal,
    { lang }
  );
  const ratingMilestoneProgress = buildRatingMilestoneProgress(record, { lang });
  const actionHistory = normalizeActionHistory(record.actionHistory);
  const weeklyDiffSummary = buildWeeklyDiffSummary(record, {
    lang,
    reviewThemeMonitoring,
    changeSummary,
    reviewDropSignal,
    weeklyReport,
  });

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
    preferredLanguage: normalizePreferredLanguage(record.preferredLanguage, lang),
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
    actionHistory: actionHistory.slice(0, ACTION_HISTORY_PUBLIC_LIMIT),
    latestAction: actionHistory[0] ?? null,
    weeklyDiffSummary,
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

function latestStoredSnapshots(history, limit = 4) {
  return (Array.isArray(history) ? history : [])
    .filter(Boolean)
    .sort((a, b) => String(b?.capturedAt || "").localeCompare(String(a?.capturedAt || "")))
    .slice(0, limit);
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

  const buildArgs = {
    reviews: details.reviews,
    details,
    photoAnalysis: reviewPhotoAnalysis({ details, comparedDetails }),
    competitor: reviewClueCompetitorFromDetails(comparedDetails),
  };
  const reviewCluesEn = buildReviewClues({ ...buildArgs, lang: "en" });
  const reviewCluesJa = buildReviewClues({ ...buildArgs, lang: "ja" });
  const reviewClues = reviewCluesEn ?? reviewCluesJa;

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
    summary: localizedPair(reviewCluesEn?.summary, reviewCluesJa?.summary),
    strengths: localizedListPair(reviewCluesEn?.strengths, reviewCluesJa?.strengths),
    frictions: localizedListPair(reviewCluesEn?.frictions, reviewCluesJa?.frictions),
    underSignaledStrengths: localizedListPair(
      reviewCluesEn?.underSignaledStrengths,
      reviewCluesJa?.underSignaledStrengths
    ),
    verificationGaps: localizedListPair(
      reviewCluesEn?.verificationGaps,
      reviewCluesJa?.verificationGaps
    ),
    competitorChoiceEdges: localizedListPair(
      reviewCluesEn?.competitorChoiceEdges,
      reviewCluesJa?.competitorChoiceEdges
    ),
    priorityAction: localizedPair(
      reviewCluesEn?.priorityAction,
      reviewCluesJa?.priorityAction
    ),
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

function themeCountMap(snapshots, key) {
  return themeFrequency(snapshots, key).reduce((acc, item) => {
    acc.set(item.label, item.count);
    return acc;
  }, new Map());
}

function themeList(snapshot, key) {
  return compactStringList(snapshot?.[key], 8);
}

function listDifference(current, previous) {
  const previousSet = new Set(Array.isArray(previous) ? previous : []);
  return compactStringList(current, 8).filter((item) => !previousSet.has(item));
}

function listIntersection(current, previous) {
  const previousSet = new Set(Array.isArray(previous) ? previous : []);
  return compactStringList(current, 8).filter((item) => previousSet.has(item));
}

function riskScore(snapshot) {
  if (!snapshot) return 0;
  return (
    compactStringList(snapshot.frictions, 8).length * 2 +
    compactStringList(snapshot.verificationGaps, 8).length +
    compactStringList(snapshot.competitorChoiceEdges, 8).length
  );
}

function buildCollectingReviewThemeMonitoring(
  lang = "en",
  {
    ownSnapshotCount = 0,
    competitorSnapshotCount = 0,
    latestCapturedAt = null,
  } = {}
) {
  const hasFirstSnapshot = ownSnapshotCount > 0;
  return {
    status: "collecting_history",
    trend: null,
    gapDirection: null,
    recurringFrictions: [],
    notableShift: hasFirstSnapshot
      ? isJapanese(lang)
        ? `保存済みレビュー傾向スナップショットは ${ownSnapshotCount}/2 件まで蓄積済みです。`
        : `${ownSnapshotCount}/2 saved review-theme snapshots collected.`
      : isJapanese(lang)
        ? "保存済みのレビュー傾向スナップショットが2回分そろうと表示されます。"
        : "Available after two saved review-theme snapshots.",
    nextAction: isJapanese(lang)
      ? hasFirstSnapshot
        ? "次回の保存済み確認後に、同じ不安要素が続いているか比較してください。"
        : "次の保存済みレビュー傾向スナップショットが追加されるまで、そのまま観測を続けてください。"
      : hasFirstSnapshot
        ? "Compare again after the next saved check to see whether the same friction repeats."
        : "Keep monitoring until another saved review snapshot is available.",
    confidence: "low",
    ownSnapshotCount,
    competitorSnapshotCount,
    latestCapturedAt,
  };
}

function buildThemeMovement({ latest, previous, ownHistory }) {
  const latestFrictions = themeList(latest, "frictions");
  const previousFrictions = themeList(previous, "frictions");
  const latestVerificationGaps = themeList(latest, "verificationGaps");
  const previousVerificationGaps = themeList(previous, "verificationGaps");
  const frequency = themeCountMap(ownHistory, "frictions");
  const verificationFrequency = themeCountMap(ownHistory, "verificationGaps");
  const latestScore = riskScore(latest);
  const previousScore = riskScore(previous);

  return {
    latestScore,
    previousScore,
    pressureDelta: latestScore - previousScore,
    recurringFrictions: latestFrictions
      .filter((item) => (frequency.get(item) || 0) >= 2)
      .slice(0, 2),
    emergingFrictions: listDifference(latestFrictions, previousFrictions).slice(0, 2),
    softenedFrictions: listDifference(previousFrictions, latestFrictions).slice(0, 2),
    repeatedFrictions: listIntersection(latestFrictions, previousFrictions).slice(0, 2),
    recurringVerificationGaps: latestVerificationGaps
      .filter((item) => (verificationFrequency.get(item) || 0) >= 2)
      .slice(0, 2),
    emergingVerificationGaps: listDifference(
      latestVerificationGaps,
      previousVerificationGaps
    ).slice(0, 2),
    softenedVerificationGaps: listDifference(
      previousVerificationGaps,
      latestVerificationGaps
    ).slice(0, 2),
  };
}

function competitorEdgeScore(ownSnapshot, competitorSnapshot) {
  const competitorEdges = themeList(ownSnapshot, "competitorChoiceEdges").length;
  const counterEdges = themeList(competitorSnapshot, "competitorChoiceEdges").length;
  return competitorEdges - counterEdges;
}

function buildGapMovement({ latest, previous, latestCompetitor, previousCompetitor }) {
  const hasCompetitorHistory = Boolean(latestCompetitor && previousCompetitor);
  const currentScore = hasCompetitorHistory
    ? competitorEdgeScore(latest, latestCompetitor)
    : themeList(latest, "competitorChoiceEdges").length;
  const previousScore = hasCompetitorHistory
    ? competitorEdgeScore(previous, previousCompetitor)
    : themeList(previous, "competitorChoiceEdges").length;
  const delta = currentScore - previousScore;

  if (!Number.isFinite(currentScore) || !Number.isFinite(previousScore)) {
    return {
      direction: null,
      currentScore: null,
      previousScore: null,
      delta: null,
      hasCompetitorHistory,
    };
  }

  return {
    direction: delta < 0 ? "narrowing" : delta > 0 ? "widening" : "unchanged",
    currentScore,
    previousScore,
    delta,
    hasCompetitorHistory,
  };
}

function buildTrendLabel({ latest, previous, movement }) {
  const latestScore = riskScore(latest);
  const previousScore = riskScore(previous);
  const delta = latestScore - previousScore;

  if (delta <= -2) return "improving";
  if (delta >= 2) return "worsening";
  if (
    movement?.emergingFrictions?.length ||
    movement?.emergingVerificationGaps?.length
  ) {
    return "worsening";
  }
  if (
    (movement?.softenedFrictions?.length || movement?.softenedVerificationGaps?.length) &&
    !movement?.recurringFrictions?.length
  ) {
    return "improving";
  }
  if (
    movement?.recurringFrictions?.length ||
    movement?.recurringVerificationGaps?.length
  ) {
    return "mixed";
  }
  return "steady";
}

function buildNotableShift({
  movement,
  trend,
  gapDirection,
}, lang = "en") {
  if (movement?.recurringFrictions?.[0]) {
    return isJapanese(lang)
      ? `${movement.recurringFrictions[0]}が直近の保存チェックで繰り返し出ています。`
      : `Recent saved checks keep showing ${movement.recurringFrictions[0]}.`;
  }

  if (movement?.emergingFrictions?.[0]) {
    return isJapanese(lang)
      ? `${movement.emergingFrictions[0]}が最新のレビュー傾向スナップショットではよりはっきり見えるようになっています。`
      : `The latest review snapshot shows ${movement.emergingFrictions[0]} more clearly.`;
  }

  if (movement?.recurringVerificationGaps?.[0]) {
    return isJapanese(lang)
      ? `${movement.recurringVerificationGaps[0]}が複数回の保存チェックで残っています。`
      : `Recent saved checks still show ${movement.recurringVerificationGaps[0]}.`;
  }

  if (movement?.softenedFrictions?.[0]) {
    return isJapanese(lang)
      ? `${movement.softenedFrictions[0]}は前回の保存チェックほど中心ではなくなっています。`
      : `Recent saved checks show less ${movement.softenedFrictions[0]} than before.`;
  }

  if (movement?.softenedVerificationGaps?.[0]) {
    return isJapanese(lang)
      ? "確認しづらさの問題は、前回の保存チェックほど中心ではなくなっています。"
      : "Verification friction looks less central than in the previous saved check.";
  }

  if (gapDirection === "narrowing") {
    return isJapanese(lang)
      ? "選択中の競合優位は、前回の保存チェックより弱まって見えます。"
      : "The selected competitor edge looks softer than it did in the previous saved check.";
  }

  if (gapDirection === "widening") {
    return isJapanese(lang)
      ? "選択中の競合優位は、前回の保存チェックより根強く見えます。"
      : "The selected competitor edge looks more persistent than it did in the previous saved check.";
  }

  if (trend === "improving") {
    return isJapanese(lang)
      ? "直近のレビュー傾向の圧力は、前回の保存チェックより軽く見えます。"
      : "Recent review-theme pressure looks lighter than in the previous saved check.";
  }

  if (trend === "worsening") {
    return isJapanese(lang)
      ? "直近のレビュー傾向の圧力は、前回の保存チェックより重く見えます。"
      : "Recent review-theme pressure looks heavier than in the previous saved check.";
  }

  return isJapanese(lang)
    ? "まだ大きなレビュー傾向の変化は目立っていません。"
    : "No major review-theme shift stands out yet.";
}

function buildTrendAwareNextAction(
  { latest, movement, trend, gapDirection },
  lang = "en"
) {
  if (
    (movement?.recurringFrictions?.length || movement?.emergingFrictions?.length) &&
    latest?.priorityAction
  ) {
    return latest.priorityAction;
  }

  if (gapDirection === "widening") {
    return isJapanese(lang)
      ? "勢いを比較し直す前に、まず見た目で分かる競合との差を埋めてください。"
      : "Close the easiest visible competitor proof gap before comparing momentum again.";
  }

  if (gapDirection === "narrowing") {
    return isJapanese(lang)
      ? "差が縮んでいる要因を次回報告に残し、同じ改善ペースを続けてください。"
      : "Document what likely narrowed the gap and keep the same improvement cadence.";
  }

  if (trend === "improving") {
    return isJapanese(lang)
      ? "最近の改善を続けつつ、同じ不安要素が静かなままか確認してください。"
      : "Keep the recent changes in place and watch whether the same friction stays quiet.";
  }

  return (
    String(latest?.priorityAction || "").trim() ||
    (isJapanese(lang)
      ? "優先順位を付けられる繰り返しの不安要素がはっきりするまで、そのまま観測を続けてください。"
      : "Keep monitoring until one repeat friction becomes clear enough to prioritize.")
  );
}

export function buildReviewThemeMonitoringSummary(record, { lang = "en" } = {}) {
  const history = normalizedReviewThemeHistory(record?.reviewThemeHistory);
  const comparisonPlaceId = String(record?.competitorPlaceId || "").trim();
  const ownPlaceId = String(record?.placeId || "").trim();
  const ownHistory = latestStoredSnapshots(
    comparisonPlaceId
      ? history.own.filter(
          (item) =>
            String(item?.comparedAgainstPlaceId || "").trim() === comparisonPlaceId
        )
      : [],
    4
  ).map((item) =>
    localizeStoredSnapshot(item, lang)
  );
  const competitorHistory = latestStoredSnapshots(
    comparisonPlaceId
      ? history.competitor.filter(
          (item) =>
            String(item?.placeId || "").trim() === comparisonPlaceId &&
            (!ownPlaceId ||
              String(item?.comparedAgainstPlaceId || "").trim() === ownPlaceId)
        )
      : [],
    4
  )
    .map((item) => localizeStoredSnapshot(item, lang));

  if (ownHistory.length < 2) {
    return buildCollectingReviewThemeMonitoring(lang, {
      ownSnapshotCount: ownHistory.length,
      competitorSnapshotCount: competitorHistory.length,
      latestCapturedAt: ownHistory[0]?.capturedAt ?? null,
    });
  }

  const latest = ownHistory[0];
  const previous = ownHistory[1];
  const movement = buildThemeMovement({ latest, previous, ownHistory });
  const trend = buildTrendLabel({ latest, previous, movement });
  const gapMovement = buildGapMovement({
    latest,
    previous,
    latestCompetitor: competitorHistory[0],
    previousCompetitor: competitorHistory[1],
  });
  const gapDirection = gapMovement.direction;
  const notableShift = buildNotableShift({
    movement,
    trend,
    gapDirection,
  }, lang);
  const sampleTotal = ownHistory.reduce(
    (sum, item) => sum + (Number.isFinite(item?.sampleReviewCount) ? Number(item.sampleReviewCount) : 0),
    0
  );

  return {
    status: "ready",
    trend,
    gapDirection,
    recurringFrictions: movement.recurringFrictions,
    emergingFrictions: movement.emergingFrictions,
    softenedFrictions: movement.softenedFrictions,
    recurringVerificationGaps: movement.recurringVerificationGaps,
    notableShift,
    nextAction: buildTrendAwareNextAction({
      latest,
      movement,
      trend,
      gapDirection,
    }, lang),
    confidence: ownHistory.length >= 3 && sampleTotal >= 6 ? "medium" : "low",
    themePressure: movement.latestScore,
    previousThemePressure: movement.previousScore,
    themePressureDelta: movement.pressureDelta,
    competitorGapScore: gapMovement.currentScore,
    previousCompetitorGapScore: gapMovement.previousScore,
    competitorGapDelta: gapMovement.delta,
    hasCompetitorThemeHistory: gapMovement.hasCompetitorHistory,
    latestSampleReviewCount: Number.isFinite(latest?.sampleReviewCount)
      ? Number(latest.sampleReviewCount)
      : null,
    previousSampleReviewCount: Number.isFinite(previous?.sampleReviewCount)
      ? Number(previous.sampleReviewCount)
      : null,
    ownSnapshotCount: ownHistory.length,
    competitorSnapshotCount: competitorHistory.length,
    latestCapturedAt: latest?.capturedAt ?? null,
    previousCapturedAt: previous?.capturedAt ?? null,
  };
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function formatSignedNumber(value, digits = 0, lang = "en") {
  if (!Number.isFinite(value) || value === 0) {
    return isJapanese(lang) ? "変化なし" : "unchanged";
  }
  const abs = Math.abs(value);
  const rounded =
    digits > 0
      ? (Math.round(abs * 10 ** digits) / 10 ** digits).toFixed(digits)
      : String(Math.round(abs));
  return `${value > 0 ? "+" : "-"}${rounded}`;
}

function buildMetricLine(label, previousValue, currentValue, digits = 0, lang = "en") {
  if (!Number.isFinite(previousValue) || !Number.isFinite(currentValue)) {
    return isJapanese(lang) ? `${label} は未取得です` : `${label} unavailable`;
  }

  const delta = currentValue - previousValue;
  return `${label} ${formatSignedNumber(delta, digits, lang)}`;
}

function formatSummaryDate(value, lang = "en") {
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) return null;

  return new Date(ts).toLocaleDateString(isJapanese(lang) ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
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

export function buildRatingMilestoneProgress(record, { lang = "en" } = {}) {
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
  let supportingCopy = isJapanese(lang)
    ? "次回の確認後に、進み具合をもう一度比較します。"
    : "We'll compare progress again after your next check";

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
        supportingCopy = isJapanese(lang)
          ? `前回チェックより ${Math.abs(deltaToPreviousEstimate)} 件少なくなりました`
          : `${Math.abs(deltaToPreviousEstimate)} fewer than last check`;
      } else if (deltaToPreviousEstimate > 0) {
        trend = "farther";
        supportingCopy = isJapanese(lang)
          ? `前回チェックより ${deltaToPreviousEstimate} 件増えました`
          : `${deltaToPreviousEstimate} more than last check`;
      } else {
        trend = "unchanged";
        supportingCopy = isJapanese(lang)
          ? "前回チェックから変化はありません"
          : "Unchanged since last check";
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
    note: isJapanese(lang)
      ? "現在表示されている評価とレビュー件数をもとにした目安です。"
      : "Estimate based on current displayed rating and total reviews",
  };
}

export function buildReviewDropSignal(record, { lang = "en" } = {}) {
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
    reason: isJapanese(lang)
      ? `前回の保存チェック以降、レビュー件数が ${dropCount} 件減っています`
      : `Review count is down by ${dropCount} since the last saved check`,
    customerImpact: isJapanese(lang)
      ? "見た目の信頼感が、前回の保存チェック時より弱くなっている可能性があります。"
      : "Visible trust may be weaker than it was at the last saved check.",
    nextCheck: isJapanese(lang)
      ? "次回も減少が続くか、競合との差がどう変わったかを確認してください。"
      : "Confirm whether the drop persists and whether the competitor gap changed.",
  };
}

export function buildSavedListingChangeSummary(record, { lang = "en" } = {}) {
  const latest = record?.latestMetrics ?? null;
  const previous = record?.previousMetrics ?? latest;
  const freshnessDate = formatSummaryDate(record?.lastCheckedAt ?? latest?.capturedAt, lang);

  if (!latest) {
    return {
      status: "pending",
      hasChange: false,
      lines: [
        isJapanese(lang)
          ? "次回の確認後に変化を比較します"
          : "We'll compare changes after your next check",
      ],
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
          ? isJapanese(lang)
            ? `${freshnessDate} 以降、大きな変化はありません`
            : `No major change since ${freshnessDate}`
          : isJapanese(lang)
            ? "前回チェック以降、大きな変化はありません"
            : "No major change since last check",
      ],
    };
  }

  return {
    status: "changed",
    hasChange: true,
    lines: [
      buildMetricLine(isJapanese(lang) ? "レビュー" : "Reviews", previous?.reviewCount, latest?.reviewCount, 0, lang),
      buildMetricLine(isJapanese(lang) ? "評価" : "Rating", previous?.rating, latest?.rating, 1, lang),
      buildMetricLine(isJapanese(lang) ? "写真" : "Photos", previous?.photoCount, latest?.photoCount, 0, lang),
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
  reviewDropSignal = null,
  { lang = "en" } = {}
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
    return buildStatusSummary(
      isJapanese(lang) ? "観測中" : "Tracking",
      "quiet",
      isJapanese(lang)
        ? "最初の保存済みスナップショットを待っています"
        : "Waiting for the first saved snapshot"
    );
  }

  if (Number.isFinite(ratingDelta) && ratingDelta < 0) {
    return buildStatusSummary(
      isJapanese(lang) ? "要確認" : "Needs attention",
      "warning",
      isJapanese(lang)
        ? `前回チェックから評価 ${formatSignedNumber(ratingDelta, 1, lang)}`
        : `Rating ${formatSignedNumber(ratingDelta, 1, lang)} since last check`
    );
  }

  if (reviewDrop?.visible) {
    return buildStatusSummary(
      isJapanese(lang) ? "要確認" : "Needs attention",
      "warning",
      reviewDrop.reason
    );
  }

  if (missing.includes("website")) {
    return buildStatusSummary(
      isJapanese(lang) ? "要確認" : "Needs attention",
      "warning",
      isJapanese(lang) ? "ウェブサイト未設定" : "Website missing"
    );
  }

  if (missing.includes("phone")) {
    return buildStatusSummary(
      isJapanese(lang) ? "要確認" : "Needs attention",
      "warning",
      isJapanese(lang) ? "電話番号未設定" : "Phone missing"
    );
  }

  if (Number.isFinite(record?.analysisScore) && record.analysisScore < 80) {
    return buildStatusSummary(
      isJapanese(lang) ? "要確認" : "Needs attention",
      "warning",
      isJapanese(lang) ? "基本情報の整い方が弱めです" : "Profile completeness is weak"
    );
  }

  if (Number.isFinite(record?.compareTotalDiff) && record.compareTotalDiff < 0) {
    return buildStatusSummary(
      isJapanese(lang) ? "改善余地" : "Opportunity",
      "accent",
      isJapanese(lang)
        ? `競合よりレビューが ${Math.abs(record.compareTotalDiff)} 件少ない状態です`
        : `Trail competitor by ${Math.abs(record.compareTotalDiff)} reviews`
    );
  }

  if (
    Number.isFinite(record?.compareDeltaDiff) &&
    record.compareDeltaDiff < 0 &&
    (!Number.isFinite(record?.compareTotalDiff) || record.compareTotalDiff <= 0)
  ) {
    return buildStatusSummary(
      isJapanese(lang) ? "改善余地" : "Opportunity",
      "accent",
      isJapanese(lang)
        ? "競合のレビュー増加ペースのほうが強めです"
        : "Competitor review momentum is stronger"
    );
  }

  if (Number.isFinite(record?.photoMissingCount) && record.photoMissingCount > 0) {
    return buildStatusSummary(
      isJapanese(lang) ? "改善余地" : "Opportunity",
      "accent",
      record.photoMissingCount >= 8
        ? isJapanese(lang)
          ? "近隣店舗より写真の充実度が弱めです"
          : "Photo coverage trails nearby listings"
        : isJapanese(lang)
          ? `写真をあと ${record.photoMissingCount} 枚ほど増やす余地があります`
          : `Add about ${record.photoMissingCount} more photos`
    );
  }

  if (Number.isFinite(reviewDelta) && reviewDelta > 0) {
    return buildStatusSummary(
      isJapanese(lang) ? "改善余地" : "Opportunity",
      "accent",
      isJapanese(lang)
        ? `前回チェックからレビュー ${formatSignedNumber(reviewDelta, 0, lang)}`
        : `Reviews ${formatSignedNumber(reviewDelta, 0, lang)} since last check`
    );
  }

  if (Number.isFinite(photoDelta) && photoDelta > 0) {
    return buildStatusSummary(
      isJapanese(lang) ? "改善余地" : "Opportunity",
      "accent",
      isJapanese(lang)
        ? `前回チェックから写真 ${formatSignedNumber(photoDelta, 0, lang)}`
        : `Photos ${formatSignedNumber(photoDelta, 0, lang)} since last check`
    );
  }

  if (summary?.status === "unchanged") {
    return buildStatusSummary(
      isJapanese(lang) ? "安定" : "Stable",
      "quiet",
      isJapanese(lang) ? "急ぎの変化は見当たりません" : "No urgent changes detected"
    );
  }

  return buildStatusSummary(
    isJapanese(lang) ? "改善余地" : "Opportunity",
    "accent",
    isJapanese(lang) ? "もう一度見返す価値があります" : "Worth another look"
  );
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

function hasSavedListingMetrics(listing) {
  const latest = listing?.latestMetrics ?? null;
  return Number.isFinite(latest?.rating) && Number.isFinite(latest?.reviewCount);
}

export async function ensureSavedListingMetrics({ KV, key, id, listing }) {
  const current = listing ?? (id ? await getSavedListing(KV, id) : null);
  if (!current || !key || hasSavedListingMetrics(current)) {
    return current;
  }

  return refreshSavedListingMetrics({ KV, key, listing: current });
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
    preferredLanguage: normalizePreferredLanguage(
      payload.preferredLanguage || existing?.preferredLanguage,
      "en"
    ),
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
    actionHistory: normalizeActionHistory(existing?.actionHistory),
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

export async function appendSavedListingAction({ KV, id, action }) {
  const current = await getSavedListing(KV, id);
  if (!current) return null;

  const now = new Date().toISOString();
  const savedAction = normalizeSavedAction(action, { now });
  if (!savedAction) {
    throw new Error("action label or body is required");
  }

  const existingHistory = normalizeActionHistory(current.actionHistory);
  const dedupedHistory = existingHistory.filter(
    (item) =>
      !(
        item.status === "planned" &&
        item.label === savedAction.label &&
        item.body === savedAction.body
      )
  );
  const actionHistory = [savedAction, ...dedupedHistory].slice(0, ACTION_HISTORY_LIMIT);
  const next = {
    ...current,
    actionHistory,
    updatedAt: now,
  };

  await KV.put(savedKey(id), JSON.stringify(next));
  return { record: next, action: savedAction };
}

export async function updateSavedListingAction({ KV, id, actionId, status, note }) {
  const current = await getSavedListing(KV, id);
  if (!current) return null;

  const now = new Date().toISOString();
  const nextStatus = normalizeActionStatus(status);
  let updatedAction = null;
  const actionHistory = normalizeActionHistory(current.actionHistory).map((item) => {
    if (String(item.id) !== String(actionId || "")) return item;

    updatedAction = {
      ...item,
      status: nextStatus,
      note: note === undefined ? item.note : compactText(note, 500),
      updatedAt: now,
      completedAt:
        nextStatus === "planned"
          ? null
          : item.completedAt || now,
    };
    return updatedAction;
  });

  if (!updatedAction) return null;

  const next = {
    ...current,
    actionHistory,
    updatedAt: now,
  };

  await KV.put(savedKey(id), JSON.stringify(next));
  return { record: next, action: updatedAction };
}

export async function listSavedListingsByEmail({ KV, email }) {
  const normalizedEmail = normalizeEmail(email);
  const ids = await readIdList(KV, emailKey(normalizedEmail));
  const records = await Promise.all(ids.map((id) => getSavedListing(KV, id)));

  return records
    .filter((item) => item && item.status !== "deleted")
    .sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
}

export async function listAllSavedListings({ KV }) {
  const ids = await readIdList(KV, SAVED_INDEX_KEY);
  const records = await Promise.all(ids.map((id) => getSavedListing(KV, id)));

  return records.filter((item) => item && item.status !== "deleted");
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
