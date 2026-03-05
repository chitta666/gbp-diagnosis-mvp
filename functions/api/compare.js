import { ymdTokyo } from "../_lib/date.js";

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

  // ①競合取得
  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) return json({ error: "competitor not set" }, 400);

  const comp = JSON.parse(rawComp);
  const competitorPlaceId = comp.competitorPlaceId;

  // ②日付
  const today = ymdTokyo();

  // ③snapshot取得
  const mySnap = await KV.get(`snap:${myPlaceId}:${today}`);
  const compSnap = await KV.get(`snap:${competitorPlaceId}:${today}`);

  if (!mySnap || !compSnap) {
    return json({ error: "snapshot missing" }, 400);
  }

  const my = JSON.parse(mySnap);
  const c = JSON.parse(compSnap);

  // ④レビュー差
  const diff =
    Number(my.user_ratings_total) - Number(c.user_ratings_total);

  return json({
    ok: true,
    today,
    my: {
      placeId: myPlaceId,
      reviews: my.user_ratings_total,
    },
    competitor: {
      placeId: competitorPlaceId,
      reviews: c.user_ratings_total,
    },
    review_diff: diff
  });
}