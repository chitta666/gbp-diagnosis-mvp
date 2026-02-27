import { clamp, round2 } from "./_lib/utils.js";
import { fetchCompetitorsAutoRadius } from "./_lib/competitors.js";
import { buildDiagnosis } from "./_lib/diagnosis.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "lat & lng are required (number)" }, 400);
  }

  const competitors = await fetchCompetitorsAutoRadius({ key, lat, lng, type: "restaurant" });

  // 例：密度スコア計算（今のままなら）
  const radius = competitors.usedRadius ?? 800;
  const count = competitors?.results?.length ?? 0;
  const areaKm2 = Math.PI * Math.pow(radius / 1000, 2);
  const density = areaKm2 > 0 ? count / areaKm2 : 0;
  const marketScore = clamp(Math.round(100 - density * 5), 0, 100);

  // details がまだ無いなら、とりあえず null で
  const diagnosis = buildDiagnosis({}, competitors);
  return json(
    {
      lat,
      lng,
      usedRadius: radius,
      competitorsCount: count,
      densityPerKm2: round2(density),
      marketScore,
      diagnosis,
      competitors,
    },
    200
  );
}