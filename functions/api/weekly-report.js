import { ymdTokyo } from "../_lib/date.js";

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

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const url = new URL(request.url);
  const myPlaceId = (url.searchParams.get("my") || "").trim();

  if (!myPlaceId) {
    return json({ ok: false, error: "my placeId required" }, 400);
  }

  const KV = env?.KV;
  if (!KV) return json({ ok: false, error: "NO_KV_BINDING" }, 500);

  // 競合取得
  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) return json({ ok: false, error: "competitor not set" }, 400);

  const comp = safeJson(rawComp);
  const competitorPlaceId = comp?.competitorPlaceId;
  if (!competitorPlaceId) {
    return json({ ok: false, error: "invalid competitor data" }, 400);
  }

  const today = ymdTokyo();
  const weekAgo = ymdTokyo(dateDaysAgo(7));

  const myTodayRaw = await KV.get(`snap:${myPlaceId}:${today}`);
  const myWeekAgoRaw = await KV.get(`snap:${myPlaceId}:${weekAgo}`);
  const compTodayRaw = await KV.get(`snap:${competitorPlaceId}:${today}`);
  const compWeekAgoRaw = await KV.get(`snap:${competitorPlaceId}:${weekAgo}`);

  if (!myTodayRaw || !compTodayRaw) {
    return json({ ok: false, error: "today snapshot missing" }, 400);
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

  const diagnosis = {
    todos: [],
  };

  // 今日の diagnose をまだつながない簡易版
  if (myToday?.website == null) {
    diagnosis.todos.push("Webサイトが未設定");
  }

  const insight = buildWeeklyInsight({
    totalDiff,
    myWeeklyGain,
    competitorWeeklyGain,
    weeklyGainDiff,
    todos: diagnosis.todos,
  });

  return json({
    ok: true,
    today,
    weekAgo,
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
    insight,
  });
}

function buildWeeklyInsight({
  totalDiff,
  myWeeklyGain,
  competitorWeeklyGain,
  weeklyGainDiff,
  todos,
}) {
  const parts = [];

  if (Number.isFinite(totalDiff)) {
    if (totalDiff > 0) parts.push(`総口コミ数は自店が${totalDiff}件多い`);
    else if (totalDiff < 0) parts.push(`総口コミ数は競合が${Math.abs(totalDiff)}件多い`);
    else parts.push("総口コミ数は同水準");
  }

  if (Number.isFinite(weeklyGainDiff)) {
    if (weeklyGainDiff > 0) parts.push(`今週の口コミ増加は自店が${weeklyGainDiff}件上回る`);
    else if (weeklyGainDiff < 0) parts.push(`今週の口コミ増加は競合が${Math.abs(weeklyGainDiff)}件上回る`);
    else parts.push("今週の口コミ増加は同水準");
  } else {
    if (Number.isFinite(myWeeklyGain) || Number.isFinite(competitorWeeklyGain)) {
      parts.push("週次比較データはまだ不足");
    }
  }

  if (Array.isArray(todos) && todos.length) {
    parts.push(`優先改善: ${todos.slice(0, 2).join(" / ")}`);
  }

  return parts.length ? parts.join("。") + "。" : "比較データがまだ不足しています。";
}