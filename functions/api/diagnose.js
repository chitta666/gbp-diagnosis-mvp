import { fetchJson } from "../_lib/utils.js";
import { fetchPlaceDetails } from "../_lib/place.js";
import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";
import { buildDiagnosis } from "../_lib/diagnosis.js";

function calcCompetitorPhotoAvg(competitors) {
  const list = Array.isArray(competitors)
    ? competitors
    : Array.isArray(competitors?.results)
      ? competitors.results
      : [];

  if (!list.length) return null;

  const nums = list
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
    advice.push("Competitor photo data is still being collected.");
  } else if (myPhotos < competitorPhotoAvg) {
    advice.push(
      `Your listing has ${competitorPhotoAvg - myPhotos} fewer photos than nearby competitors.`
    );
  } else {
    advice.push("Your listing photo coverage is keeping pace with nearby competitors.");
  }

  return {
    recommendedShots: [
      "Storefront / Exterior",
      "Signature Dishes",
      "Menu",
      "Interior Atmosphere",
      "Staff / Team",
    ],
    advice,
  };
}

function filterCompetitors(competitors, myPlaceId) {
  if (!Array.isArray(competitors?.results)) return competitors;

  return {
    ...competitors,
    results: competitors.results.filter((item) => item?.place_id !== myPlaceId),
  };
}

async function addCompetitorPhotoCounts({ key, competitors, limit = 3 }) {
  if (!Array.isArray(competitors?.results) || !competitors.results.length) {
    return competitors;
  }

  const targets = competitors.results.slice(0, limit);
  const photoCounts = await Promise.all(
    targets.map(async (item) => {
      try {
        const details = await fetchPlaceDetails({ key, placeId: item.place_id });
        return {
          placeId: item.place_id,
          photoCount: Array.isArray(details?.photos) ? details.photos.length : null,
        };
      } catch {
        return {
          placeId: item.place_id,
          photoCount: null,
        };
      }
    })
  );

  const photoCountByPlaceId = new Map(
    photoCounts.map((item) => [item.placeId, item.photoCount])
  );

  return {
    ...competitors,
    results: competitors.results.map((item) => ({
      ...item,
      photoCount: photoCountByPlaceId.get(item.place_id) ?? null,
    })),
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const publicError = (code, message, status = 400) =>
    json({ ok: false, code, message }, status);

  try {
    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return publicError(
        "SERVICE_UNAVAILABLE",
        "The analysis service is temporarily unavailable.",
        500
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return publicError(
        "BAD_INPUT",
        "Enter a business name and address.",
        400
      );
    }

    const findUrl =
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
      `?input=${encodeURIComponent(q)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name,formatted_address` +
      `&language=en` +
      `&key=${encodeURIComponent(key)}`;

    const found = await fetchJson(findUrl);

    if (found.status !== "OK" || !found.candidates?.length) {
      return publicError(
        "PLACE_NOT_FOUND",
        "We couldn't find that business. Try the business name with the full address.",
        404
      );
    }

    const candidate = found.candidates[0];
    const placeId = candidate.place_id;

    const details = await fetchPlaceDetails({ key, placeId });

    if (!details?.ok) {
      return publicError(
        "PLACE_DETAILS_FAILED",
        "We couldn't load the business details for that listing.",
        502
      );
    }

    const lat = Number(details?.geometry?.location?.lat);
    const lng = Number(details?.geometry?.location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return publicError(
        "LOCATION_UNAVAILABLE",
        "We couldn't determine the business location for comparison.",
        400
      );
    }

    const competitors = await fetchCompetitorsAutoRadius({
      key,
      lat,
      lng,
      type: "restaurant",
    });
    const filteredCompetitors = filterCompetitors(competitors, placeId);
    const enrichedCompetitors = await addCompetitorPhotoCounts({
      key,
      competitors: filteredCompetitors,
    });

    const diagnosis = buildDiagnosis(details, enrichedCompetitors);

    const myPhotos = Array.isArray(details?.photos) ? details.photos.length : 0;
    const competitorPhotoAvg = calcCompetitorPhotoAvg(enrichedCompetitors);
    const missingPhotos =
      competitorPhotoAvg != null
        ? Math.max(competitorPhotoAvg - myPhotos, 0)
        : null;

    const photoAdvice = buildPhotoAdvice(myPhotos, competitorPhotoAvg);
    const publicDetails = {
      ok: true,
      place_id: details.place_id,
      placeId: details.placeId,
      name: details.name,
      formatted_address: details.formatted_address,
      address: details.address,
      international_phone_number: details.international_phone_number,
      website: details.website,
      photos: details.photos,
      rating: details.rating,
      user_ratings_total: details.user_ratings_total,
      geometry: details.geometry,
    };

    return json({
      ok: true,
      placeId,
      diagnosis,
      details: publicDetails,
      competitors: enrichedCompetitors,
      photoAnalysis: {
        myPhotos,
        competitorPhotoAvg,
        missingPhotos,
      },
      photoAdvice,
      defaultCompetitorPlaceId:
        enrichedCompetitors?.results?.[0]?.place_id ?? null,
    });
  } catch (e) {
    console.error("diagnose failed", e);
    return publicError(
      "INTERNAL_ERROR",
      "Something went wrong while analyzing this listing. Please try again.",
      500
    );
  }

}
