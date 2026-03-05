// functions/api/snapshot.js
import { ymdTokyo } from "../_lib/date.js";
import { fetchPlaceDetails } from "../_lib/place.js";

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") || "").trim();

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (!placeId) return json({ error: "placeId is required" }, 400);

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  const KV = env?.KV;
  if (!KV) return json({ error: "NO_KV_BINDING (env.KV)" }, 500);

  // 1) Placesから今の値を取得
  const info = await fetchPlaceDetails({ key, placeId });
  if (!info.ok) return json({ error: "Place Details failed", info }, 400);

  // 2) KVキー（Tokyo日付）
  const today = ymdTokyo();
  const yesterday = ymdTokyo(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const kToday = `snap:${placeId}:${today}`;
  const kYday = `snap:${placeId}:${yesterday}`;

  // 3) 昨日を読んで差分（保存前に計算）
  const rawY = await KV.get(kYday);
  const y = rawY ? safeJson(rawY) : null;

  const yTotal = y ? Number(y.user_ratings_total) : NaN;
  const cTotal = Number(info.user_ratings_total);

  const delta =
    Number.isFinite(yTotal) && Number.isFinite(cTotal) ? cTotal - yTotal : null;

  // 4) 今日を保存（失敗したら落とす）
  const payload = {
    ts: Date.now(),
    date: today,
    placeId,
    name: info.name ?? null,
    address: info.address ?? null,
    rating: info.rating ?? null,
    user_ratings_total: info.user_ratings_total ?? null,
  };

  try {
    await KV.put(kToday, JSON.stringify(payload));
  } catch (e) {
    return json(
      { error: "KV.put failed", storedKey: kToday, message: String(e) },
      500
    );
  }

  return json({
    ok: true,
    placeId,
    today,
    yesterday,
    current: {
      rating: info.rating ?? null,
      user_ratings_total: info.user_ratings_total ?? null,
    },
    yesterdaySnapshot: y
      ? {
          rating: y.rating ?? null,
          user_ratings_total: y.user_ratings_total ?? null,
        }
      : null,
    delta_user_ratings_total: delta,
    storedKey: kToday,
  });
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}