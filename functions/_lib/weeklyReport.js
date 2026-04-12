import { ymdTokyo } from "./date.js";

function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function weeklyCopy(lang = "en") {
  const ja = isJapanese(lang);

  return {
    trackingMessage: ja
      ? "週次の傾向を追跡しています。意味のある変化は、日次スナップショットが約7日分たまってから見えやすくなります。"
      : "Tracking weekly trends. Meaningful changes usually appear after about 7 days of daily snapshots.",
    moreTotalReviews: ({ count }) =>
      ja
        ? `あなたのビジネスはレビュー総数で${count}件リードしています。`
        : `Your business has ${count} more total reviews.`,
    competitorsMoreTotalReviews: ({ count }) =>
      ja
        ? `競合のほうがレビュー総数で${count}件多い状態です。`
        : `Competitors have ${count} more total reviews.`,
    totalReviewCountSimilar: ja
      ? "レビュー総数はほぼ同水準です。"
      : "Total review count is similar.",
    moreReviewsThisWeek: ({ count }) =>
      ja
        ? `今週はあなたのビジネスのほうがレビューを${count}件多く獲得しています。`
        : `Your business gained ${count} more reviews this week.`,
    competitorsMoreReviewsThisWeek: ({ count }) =>
      ja
        ? `今週は競合のほうがレビューを${count}件多く獲得しています。`
        : `Competitors gained ${count} more reviews this week.`,
    weeklyGrowthSimilar: ja
      ? "今週のレビュー増加はほぼ同水準です。"
      : "Weekly review growth is similar.",
    weeklyTrackingStarting: ja
      ? "週次トラッキングを開始しています。"
      : "Weekly tracking is starting.",
    savingFirstDailySnapshots: ja
      ? "週次トラッキング用の最初の日次スナップショットを保存しています。"
      : "Saving the first daily snapshots for weekly tracking.",
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function dateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function buildWeeklyInsight({
  totalDiff,
  myWeeklyGain,
  competitorWeeklyGain,
  weeklyGainDiff,
  lang = "en",
}) {
  const copy = weeklyCopy(lang);
  const parts = [];

  if (Number.isFinite(totalDiff)) {
    if (totalDiff > 0) parts.push(copy.moreTotalReviews({ count: totalDiff }));
    else if (totalDiff < 0) {
      parts.push(copy.competitorsMoreTotalReviews({ count: Math.abs(totalDiff) }));
    } else {
      parts.push(copy.totalReviewCountSimilar);
    }
  }

  if (Number.isFinite(weeklyGainDiff)) {
    if (weeklyGainDiff > 0) {
      parts.push(copy.moreReviewsThisWeek({ count: weeklyGainDiff }));
    } else if (weeklyGainDiff < 0) {
      parts.push(copy.competitorsMoreReviewsThisWeek({ count: Math.abs(weeklyGainDiff) }));
    } else {
      parts.push(copy.weeklyGrowthSimilar);
    }
  } else if (
    Number.isFinite(myWeeklyGain) ||
    Number.isFinite(competitorWeeklyGain)
  ) {
    parts.push(copy.trackingMessage);
  }

  return parts.length ? parts.join(" ") : copy.trackingMessage;
}

export async function getWeeklyReport({ KV, myPlaceId, lang = "en" }) {
  const copy = weeklyCopy(lang);
  const today = ymdTokyo();
  const weekAgo = ymdTokyo(dateDaysAgo(7));

  const baseResponse = ({
    competitorPlaceId = null,
    status = "ready",
    message = null,
    insight = copy.trackingMessage,
  } = {}) => ({
    ok: true,
    status,
    message,
    today,
    weekAgo,
    my: {
      placeId: myPlaceId || null,
      todayTotal: null,
      weekAgoTotal: null,
      weeklyGain: null,
    },
    competitor: {
      placeId: competitorPlaceId,
      todayTotal: null,
      weekAgoTotal: null,
      weeklyGain: null,
    },
    totalDiff: null,
    weeklyGainDiff: null,
    insight,
  });

  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) {
    return baseResponse({
      status: "setup_required",
      message: copy.weeklyTrackingStarting,
      insight: copy.trackingMessage,
    });
  }

  const comp = safeJson(rawComp);
  const competitorPlaceId = comp?.competitorPlaceId;
  if (!competitorPlaceId) {
    return baseResponse({
      status: "setup_required",
      message: copy.weeklyTrackingStarting,
      insight: copy.trackingMessage,
    });
  }

  const myTodayRaw = await KV.get(`snap:${myPlaceId}:${today}`);
  const myWeekAgoRaw = await KV.get(`snap:${myPlaceId}:${weekAgo}`);
  const compTodayRaw = await KV.get(`snap:${competitorPlaceId}:${today}`);
  const compWeekAgoRaw = await KV.get(`snap:${competitorPlaceId}:${weekAgo}`);

  const response = baseResponse({ competitorPlaceId });

  if (!myTodayRaw || !compTodayRaw) {
    return {
      ...response,
      status: "collecting_daily_data",
      message: copy.savingFirstDailySnapshots,
      insight: copy.trackingMessage,
    };
  }

  const myToday = safeJson(myTodayRaw);
  const myWeekAgo = myWeekAgoRaw ? safeJson(myWeekAgoRaw) : null;
  const compToday = safeJson(compTodayRaw);
  const compWeekAgo = compWeekAgoRaw ? safeJson(compWeekAgoRaw) : null;

  const myTodayTotal = Number(myToday?.user_ratings_total);
  const myWeekAgoTotal = Number(myWeekAgo?.user_ratings_total);
  const compTodayTotal = Number(compToday?.user_ratings_total);
  const compWeekAgoTotal = Number(compWeekAgo?.user_ratings_total);

  const myWeeklyGain =
    Number.isFinite(myTodayTotal) && Number.isFinite(myWeekAgoTotal)
      ? myTodayTotal - myWeekAgoTotal
      : null;

  const competitorWeeklyGain =
    Number.isFinite(compTodayTotal) && Number.isFinite(compWeekAgoTotal)
      ? compTodayTotal - compWeekAgoTotal
      : null;

  const totalDiff =
    Number.isFinite(myTodayTotal) && Number.isFinite(compTodayTotal)
      ? myTodayTotal - compTodayTotal
      : null;

  const weeklyGainDiff =
    Number.isFinite(myWeeklyGain) && Number.isFinite(competitorWeeklyGain)
      ? myWeeklyGain - competitorWeeklyGain
      : null;

  const insight = buildWeeklyInsight({
    totalDiff,
    myWeeklyGain,
    competitorWeeklyGain,
    weeklyGainDiff,
    lang,
  });

  return {
    ...response,
    status: myWeekAgoRaw && compWeekAgoRaw ? "ready" : "collecting_history",
    message:
      myWeekAgoRaw && compWeekAgoRaw
        ? null
        : copy.trackingMessage,
    my: {
      placeId: myPlaceId,
      todayTotal: Number.isFinite(myTodayTotal) ? myTodayTotal : null,
      weekAgoTotal: Number.isFinite(myWeekAgoTotal) ? myWeekAgoTotal : null,
      weeklyGain: myWeeklyGain,
    },
    competitor: {
      placeId: competitorPlaceId,
      todayTotal: Number.isFinite(compTodayTotal) ? compTodayTotal : null,
      weekAgoTotal: Number.isFinite(compWeekAgoTotal) ? compWeekAgoTotal : null,
      weeklyGain: competitorWeeklyGain,
    },
    totalDiff,
    weeklyGainDiff,
    insight:
      myWeekAgoRaw && compWeekAgoRaw
        ? insight
        : copy.trackingMessage,
  };
}
