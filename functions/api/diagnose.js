import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";
import { buildDiagnosis } from "../_lib/diagnosis.js";
// clamp, round2 は今使ってないなら消してOK
// import { clamp, round2 } from "../_lib/utils.js";

export async function onRequest(context) {
  try {
    const { request, env } = context;

    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) return new Response("NO_KEY", { status: 500 });

    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response("BAD_LATLNG", { status: 400 });
    }

    const competitors = await fetchCompetitorsAutoRadius({
      key,
      lat,
      lng,
      type: "restaurant",
    });

    const diagnosis = buildDiagnosis({}, competitors); // detailsは仮で空オブジェクト

    return new Response(JSON.stringify({ competitors, diagnosis }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response("CRASH: " + (e?.stack || e?.message || String(e)), { status: 500 });
  }
}