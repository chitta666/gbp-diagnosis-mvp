import { fetchJson } from "../_lib/utils.js";
import { fetchPlaceDetails } from "../_lib/place.js";
import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";
import { buildDiagnosis } from "../_lib/diagnosis.js";

function calcCompetitorPhotoAvg(competitors) {
  if (!Array.isArray(competitors) || !competitors.length) return null;

  const nums = competitors
    .map((c) => {
      if (Array.isArray(c?.photos)) return c.photos.length;
      if (Number.isFinite(c?.photoCount)) return Number(c.photoCount);
      return null;
    })
    .filter((n) => Number.isFinite(n));

  if (!nums.length) return null;

  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round(sum / nums.length);
}

function buildPhotoAdvice(myPhotos, competitorPhotoAvg) {
  const advice = [];

  if (competitorPhotoAvg == null) {
    advice.push("競合写真データが取得できていません");
  } else if (myPhotos < competitorPhotoAvg) {
    advice.push(`競合平均より${competitorPhotoAvg - myPhotos}枚写真が少ない`);
  }

  return {
    recommendedShots: [
      "外観",
      "料理",
      "メニュー",
      "店内",
      "スタッフ"
    ],
    advice
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  try {
    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) return json({ ok: false, error: "NO_KEY" }, 500);

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return json({ ok: false, error: "q required" }, 400);
    }

    // 1) 店名 or 店名+住所 から placeId 解決
    const findUrl =
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
      `?input=${encodeURIComponent(q)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name,formatted_address` +
      `&language=ja` +
      `&key=${encodeURIComponent(key)}`;

    const found = await fetchJson(findUrl);

    if (found.status !== "OK" || !found.candidates?.length) {
      return json(
        {
          ok: false,
          error: "PLACE_NOT_FOUND",
          status: found.status,
          raw: found,
        },
        400
      );
    }

    const candidate = found.candidates[0];
    const placeId = candidate.place_id;

    // 2) place details 取得
    const details = await fetchPlaceDetails({ key, placeId });

    if (!details?.ok) {
      return json(
        {
          ok: false,
          error: "PLACE_DETAILS_FAILED",
          details,
        },
        400
      );
    }

    // 3) lat/lng 取得
    const lat = Number(details?.geometry?.location?.lat);
    const lng = Number(details?.geometry?.location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json(
        {
          ok: false,
          error: "BAD_LATLNG",
          placeId,
          details,
        },
        400
      );
    }

    // 4) 競合取得
    const competitors = await fetchCompetitorsAutoRadius({
      key,
      lat,
      lng,
      type: "restaurant",
    });

    // 5) 診断生成
    const diagnosis = buildDiagnosis(details, competitors);

    // 6) 写真比較
    const myPhotos = Array.isArray(details?.photos) ? details.photos.length : 0;
    const competitorPhotoAvg = calcCompetitorPhotoAvg(competitors);
    const missingPhotos =
      competitorPhotoAvg != null
        ? Math.max(competitorPhotoAvg - myPhotos, 0)
        : null;

const photoAdvice = buildPhotoAdvice(myPhotos, competitorPhotoAvg);

return json({
  ok: true,
  placeId,
  diagnosis,
  details,
  competitors,
  photoAnalysis: {
    myPhotos,
    competitorPhotoAvg,
    missingPhotos,
  },
  photoAdvice
});
  } catch (e) {
    return json(
      {
        ok: false,
        error: "CRASH",
        message: e?.message || String(e),
        stack: e?.stack || null,
      },
      500
    );
  }

}
