import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";

export async function onRequest({ request, env }) {
  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("NO_KEY", { status: 500 });

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response("BAD_LATLNG", { status: 400 });
  }

  const competitors = await fetchCompetitorsAutoRadius({ key, lat, lng, type: "restaurant" });

  return new Response(JSON.stringify({ ok: true, competitors }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}