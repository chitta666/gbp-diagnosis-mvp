import { ymdTokyo } from "../_lib/date.js";
import { saveSnapshot } from "../_lib/snapshot.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const KV = env?.KV;
  if (!KV) return json({ ok: false, error: "NO_KV_BINDING" }, 500);

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ ok: false, error: "NO_KEY" }, 500);

  const url = new URL(request.url);
  const myPlaceId = (url.searchParams.get("my") || "").trim();

  if (!myPlaceId) {
    return json({ ok: false, error: "my placeId required" }, 400);
  }

  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) {
    return json({ ok: false, error: "competitor not set" }, 400);
  }

  const comp = JSON.parse(rawComp);
  const competitorPlaceId = comp.competitorPlaceId;

  const my = await saveSnapshot({ KV, key, placeId: myPlaceId });
  const competitor = await saveSnapshot({ KV, key, placeId: competitorPlaceId });

  return json({
    ok: true,
    today: ymdTokyo(),
    myPlaceId,
    competitorPlaceId,
    my,
    competitor,
  });
}