import { fetchPlaceDetails } from "../_lib/place.js";
import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";
import { buildDiagnosis } from "../_lib/diagnosis.js";

export async function onRequest({ request, env }) {
  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("NO_KEY", { status: 500 });

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const place_id = url.searchParams.get("place_id"); // 使うなら

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return new Response("BAD_LATLNG", { status: 400 });

  const competitors = await fetchCompetitorsAutoRadius({ key, lat, lng, type: "restaurant" });

  const details = place_id
    ? await fetchPlaceDetails({ key, place_id })
    : null;

  const diagnosis = buildDiagnosis(details, competitors);

  return new Response(JSON.stringify(diagnosis, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}