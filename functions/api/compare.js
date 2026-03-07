import { ymdTokyo } from "../_lib/date.js";

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const myPlaceId = (url.searchParams.get("my") || "").trim();

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (!myPlaceId) {
    return json({ error: "my placeId required" }, 400);
  }

  const KV = env?.KV;
  if (!KV) return json({ error: "NO_KV_BINDING" }, 500);

  // ① 競合取得
  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) return json({ error: "competitor not set" }, 400);

  const comp = safeJson(rawComp);
  const competitorPlaceId = comp?.competitorPlaceId;
  if (!competitorPlaceId) {
    return json({ error: "invalid competitor data" }, 400);
  }

  // ② 日付
  const today = ymdTokyo();
  const yesterday = ymdTokyo(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // ③ snapshot取得
  const myTodayRaw = await KV.get(`snap:${myPlaceId}:${today}`);
  const myYdayRaw = await KV.get(`snap:${myPlaceId}:${yesterday}`);
  const compTodayRaw = await KV.get(`snap:${competitorPlaceId}:${today}`);
  const compYdayRaw = await KV.get(`snap:${competitorPlaceId}:${yesterday}`);

  if (!myTodayRaw || !compTodayRaw) {
    return json({ error: "today snapshot missing" }, 400);
  }

  const myToday = safeJson(myTodayRaw);
  const myYday = myYdayRaw ? safeJson(myYdayRaw) : null;
  const compToday = safeJson(compTodayRaw);
  const compYday = compYdayRaw ? safeJson(compYdayRaw) : null;

  const myTodayTotal = Number(myToday?.user_ratings_total);
  const myYdayTotal = Number(myYday?.user_ratings_total);
  const compTodayTotal = Number(compToday?.user_ratings_total);
  const compYdayTotal = Number(compYday?.user_ratings_total);

  const myDelta =
    Number.isFinite(myTodayTotal) && Number.isFinite(myYdayTotal)
      ? myTodayTotal - myYdayTotal
      : null;

  const competitorDelta =
    Number.isFinite(compTodayTotal) && Number.isFinite(compYdayTotal)
      ? compTodayTotal - compYdayTotal
      : null;

  const totalDiff =
    Number.isFinite(myTodayTotal) && Number.isFinite(compTodayTotal)
      ? myTodayTotal - compTodayTotal
      : null;

  const deltaDiff =
    Number.isFinite(myDelta) && Number.isFinite(competitorDelta)
      ? myDelta - competitorDelta
      : null;

  return json({
    ok: true,
    today,
    yesterday,
    my: {
      placeId: myPlaceId,
      todayTotal: Number.isFinite(myTodayTotal) ? myTodayTotal : null,
      yesterdayTotal: Number.isFinite(myYdayTotal) ? myYdayTotal : null,
      delta: myDelta,
    },
    competitor: {
      placeId: competitorPlaceId,
      todayTotal: Number.isFinite(compTodayTotal) ? compTodayTotal : null,
      yesterdayTotal: Number.isFinite(compYdayTotal) ? compYdayTotal : null,
      delta: competitorDelta,
    },
    total_diff: totalDiff,
    delta_diff: deltaDiff,
  });
}