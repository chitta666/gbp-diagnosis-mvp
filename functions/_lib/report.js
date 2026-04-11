import {
  fetchJson,
  mapGooglePlacesApiError,
  mapGooglePlacesTransportError,
} from "./utils.js";
import { fetchPlaceDetails } from "./place.js";
import { fetchCompetitorsAutoRadius } from "./competitors.js";
import { buildDiagnosis } from "./diagnosis.js";
import { buildReviewClues } from "./reviewClues.js";

export async function resolvePlaceIdFromQuery({ key, q }) {
  try {
    const findUrl =
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
      `?input=${encodeURIComponent(q)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name,formatted_address` +
      `&language=en` +
      `&key=${encodeURIComponent(key)}`;

    const found = await fetchJson(findUrl);
    const mappedError = mapGooglePlacesApiError({
      status: found?.status,
      errorMessage: found?.error_message,
    });
    if (mappedError) {
      return {
        ok: false,
        ...mappedError,
      };
    }

    if (!found.candidates?.length) {
      return {
        ok: false,
        code: "PLACE_NOT_FOUND",
        message:
          "We couldn't find that business. Try the business name with the full address.",
        hint: "Try the business name with the full address.",
        httpStatus: 404,
        upstreamStatus: found?.status ?? null,
        upstreamErrorMessage: found?.error_message ?? null,
      };
    }

    return {
      ok: true,
      placeId: found.candidates[0].place_id,
      candidate: found.candidates[0],
    };
  } catch (error) {
    return {
      ok: false,
      ...mapGooglePlacesTransportError(error),
    };
  }
}

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

function pickNearestDefaultCompetitor({ competitors }) {
  const list = Array.isArray(competitors?.results) ? competitors.results : [];
  if (!list.length) return null;

  const nearest = list.find((item) => item?.place_id && Number.isFinite(item?.distance_meters));
  return nearest?.place_id ?? list[0]?.place_id ?? null;
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

export async function buildListingReport({ key, placeId }) {
  const details = await fetchPlaceDetails({ key, placeId });

  if (!details?.ok) {
    return {
      ok: false,
      code: details?.code || "PLACE_DETAILS_FAILED",
      message: details?.message || "We couldn't load the business details for that listing.",
      hint: details?.hint ?? null,
      httpStatus: details?.httpStatus ?? 502,
      upstreamStatus: details?.upstreamStatus ?? details?.status ?? null,
      upstreamErrorMessage: details?.upstreamErrorMessage ?? null,
    };
  }

  const lat = Number(details?.geometry?.location?.lat);
  const lng = Number(details?.geometry?.location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      ok: false,
      code: "LOCATION_UNAVAILABLE",
      message: "We couldn't determine the business location for comparison.",
    };
  }

  const competitors = await fetchCompetitorsAutoRadius({
    key,
    lat,
    lng,
    listingTypes: details?.types ?? [],
    myReviewCount: details?.user_ratings_total ?? null,
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
    competitorPhotoAvg != null ? Math.max(competitorPhotoAvg - myPhotos, 0) : null;

  const photoAdvice = buildPhotoAdvice(myPhotos, competitorPhotoAvg);
  const defaultCompetitorPlaceId = pickNearestDefaultCompetitor({
    competitors: enrichedCompetitors,
  });
  const defaultCompetitor =
    (Array.isArray(enrichedCompetitors?.results)
      ? enrichedCompetitors.results.find((item) => item?.place_id === defaultCompetitorPlaceId)
      : null) ?? null;
  const reviewClues = buildReviewClues({
    reviews: details.reviews,
    details,
    photoAnalysis: {
      myPhotos,
      competitorPhotoAvg,
      missingPhotos,
    },
    competitor: defaultCompetitor,
  });
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
    types: details.types,
    reviews: Array.isArray(details.reviews) ? details.reviews : [],
  };

  return {
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
    reviewClues,
    defaultCompetitorPlaceId,
  };
}
