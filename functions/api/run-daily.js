import { runDailyForPlace } from "../_lib/runDaily.js";

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

  const result = await runDailyForPlace({ KV, key, myPlaceId });
  return json(result, result.ok ? 200 : 400);
}