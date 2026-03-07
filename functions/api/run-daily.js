import { fetchPlaceDetails } from "../_lib/place.js";
import { ymdTokyo } from "../_lib/date.js";

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
  const today = ymdTokyo();

  async function saveSnapshot(placeId) {
    const info = await fetchPlaceDetails({ key, placeId });

    if (!info.ok) {
      return {
        ok: false,
        placeId,
        error: "PLACE_DETAILS_FAILED",
        info,
      };
    }

    const snapKey = `snap:${placeId}:${today}`;
    const payload = {
      ts: Date.now(),
      date: today,
      placeId,
      name: info.name ?? null,
      address: info.address ?? null,
      rating: info.rating ?? null,
      user_ratings_total: info.user_ratings_total ?? null,
    };

    await KV.put(snapKey, JSON.stringify(payload));

    return {
      ok: true,
      snapKey,
      payload,
    };
  }

  const my = await saveSnapshot(myPlaceId);
  const competitor = await saveSnapshot(competitorPlaceId);

  return json({
    ok: true,
    today,
    myPlaceId,
    competitorPlaceId,
    my,
    competitor,
  });
}