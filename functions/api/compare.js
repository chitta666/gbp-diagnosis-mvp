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

  const today = ymdTokyo();
  const yesterday = ymdTokyo(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const baseResponse = ({
    competitorPlaceId = null,
    status = "ready",
    message = null,
  } = {}) => ({
    ok: true,
    status,
    message,
    today,
    yesterday,
    my: {
      placeId: myPlaceId || null,
      todayTotal: null,
      yesterdayTotal: null,
      delta: null,
    },
    competitor: {
      placeId: competitorPlaceId,
      todayTotal: null,
      yesterdayTotal: null,
      delta: null,
    },
    total_diff: null,
    delta_diff: null,
  });

  if (!myPlaceId) {
    return json(
      { ok: false, code: "BAD_REQUEST", message: "A place ID is required." },
      400
    );
  }

  const KV = env?.KV;
  if (!KV) {
    return json(
      {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Comparison data is temporarily unavailable.",
      },
      500
    );
  }

  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) {
    return json(
      baseResponse({
        status: "setup_required",
        message: "Comparison data is being prepared.",
      })
    );
  }

  const comp = safeJson(rawComp);
  const competitorPlaceId = comp?.competitorPlaceId;
  if (!competitorPlaceId) {
    return json(
      baseResponse({
        status: "setup_required",
        message: "Comparison data is being prepared.",
      })
    );
  }

  const myTodayRaw = await KV.get(`snap:${myPlaceId}:${today}`);
  const myYdayRaw = await KV.get(`snap:${myPlaceId}:${yesterday}`);
  const compTodayRaw = await KV.get(`snap:${competitorPlaceId}:${today}`);
  const compYdayRaw = await KV.get(`snap:${competitorPlaceId}:${yesterday}`);

  const response = baseResponse({ competitorPlaceId });

  if (!myTodayRaw || !compTodayRaw) {
    return json({
      ...response,
      status: "collecting_daily_data",
      message: "Comparison snapshots are being prepared.",
    });
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
    ...response,
    status: myYdayRaw && compYdayRaw ? "ready" : "collecting_history",
    message:
      myYdayRaw && compYdayRaw
        ? null
        : "Daily change will appear after more snapshots are saved.",
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
