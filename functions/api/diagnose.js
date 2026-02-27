import { clamp, round2 } from "./_lib/utils.js";
import { fetchCompetitorsAutoRadius } from "./_lib/competitors.js";
import { buildDiagnosis } from "./_lib/diagnosis.js";

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // 1) envだけ確認
    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) return new Response("NO_KEY", { status: 500 });

    // 2) URLパース確認
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response("BAD_LATLNG", { status: 400 });
    }

    // 3) ここまでOKなら次の段階へ
    return new Response("PARSE_OK", { status: 200 });

  } catch (e) {
// ここまでOKのあと

const competitors = await fetchCompetitorsAutoRadius({ key, lat, lng, type: "restaurant" });

// まずは status だけ返す
return new Response("FETCH_OK: " + (competitors?.status ?? "NO_STATUS"), { status: 200 });

  }
}