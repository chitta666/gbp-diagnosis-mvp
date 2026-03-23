import { ymdTokyo } from "./date.js";

const WEEKLY_TRACKING_MESSAGE =
  "Tracking weekly trends. Meaningful changes usually appear after about 7 days of daily snapshots.";

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
}) {
  const parts = [];

  if (Number.isFinite(totalDiff)) {
    if (totalDiff > 0) parts.push(`Your business has ${totalDiff} more total reviews.`);
    else if (totalDiff < 0) {
      parts.push(`Competitors have ${Math.abs(totalDiff)} more total reviews.`);
    } else {
      parts.push("Total review count is similar.");
    }
  }

  if (Number.isFinite(weeklyGainDiff)) {
    if (weeklyGainDiff > 0) {
      parts.push(`Your business gained ${weeklyGainDiff} more reviews this week.`);
    } else if (weeklyGainDiff < 0) {
      parts.push(`Competitors gained ${Math.abs(weeklyGainDiff)} more reviews this week.`);
    } else {
      parts.push("Weekly review growth is similar.");
    }
  } else if (
    Number.isFinite(myWeeklyGain) ||
    Number.isFinite(competitorWeeklyGain)
  ) {
    parts.push(WEEKLY_TRACKING_MESSAGE);
  }

  return parts.length ? parts.join(" ") : WEEKLY_TRACKING_MESSAGE;
}

export async function getWeeklyReport({ KV, myPlaceId }) {
  const today = ymdTokyo();
  const weekAgo = ymdTokyo(dateDaysAgo(7));

  const baseResponse = ({
    competitorPlaceId = null,
    status = "ready",
    message = null,
    insight = WEEKLY_TRACKING_MESSAGE,
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
      message: "Weekly tracking is starting.",
      insight: WEEKLY_TRACKING_MESSAGE,
    });
  }

  const comp = safeJson(rawComp);
  const competitorPlaceId = comp?.competitorPlaceId;
  if (!competitorPlaceId) {
    return baseResponse({
      status: "setup_required",
      message: "Weekly tracking is starting.",
      insight: WEEKLY_TRACKING_MESSAGE,
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
      message: "Saving the first daily snapshots for weekly tracking.",
      insight: WEEKLY_TRACKING_MESSAGE,
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
  });

  return {
    ...response,
    status: myWeekAgoRaw && compWeekAgoRaw ? "ready" : "collecting_history",
    message:
      myWeekAgoRaw && compWeekAgoRaw
        ? null
        : "Tracking weekly trends. Meaningful changes usually appear after about 7 days of daily snapshots.",
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
        : WEEKLY_TRACKING_MESSAGE,
  };
}
