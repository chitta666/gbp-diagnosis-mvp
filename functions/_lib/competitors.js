import { fetchJson, clamp } from "./utils.js";

const GENERIC_PLACE_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "food",
  "store",
  "premise",
  "subpremise",
  "route",
  "street_address",
  "political",
]);

const SUPPORTED_NEARBY_TYPES = new Set([
  "bakery",
  "bar",
  "cafe",
  "car_dealer",
  "car_rental",
  "car_repair",
  "car_wash",
  "dentist",
  "doctor",
  "drugstore",
  "electrician",
  "florist",
  "funeral_home",
  "furniture_store",
  "gym",
  "hair_care",
  "hardware_store",
  "home_goods_store",
  "hospital",
  "insurance_agency",
  "jewelry_store",
  "laundry",
  "lawyer",
  "library",
  "liquor_store",
  "lodging",
  "meal_delivery",
  "meal_takeaway",
  "movie_theater",
  "museum",
  "night_club",
  "painter",
  "park",
  "pet_store",
  "pharmacy",
  "physiotherapist",
  "plumber",
  "real_estate_agency",
  "restaurant",
  "roofing_contractor",
  "school",
  "shoe_store",
  "shopping_mall",
  "spa",
  "storage",
  "supermarket",
  "tourist_attraction",
  "travel_agency",
  "veterinary_care",
]);

const TYPE_ALIASES = new Map([
  ["coffee_shop", "cafe"],
  ["espresso_bar", "cafe"],
  ["tea_house", "cafe"],
  ["brunch_restaurant", "restaurant"],
  ["japanese_restaurant", "restaurant"],
  ["ramen_restaurant", "restaurant"],
  ["sushi_restaurant", "restaurant"],
  ["steak_house", "restaurant"],
  ["pizza_restaurant", "restaurant"],
  ["izakaya_restaurant", "bar"],
  ["pub", "bar"],
  ["cocktail_bar", "bar"],
  ["karaoke", "night_club"],
  ["karaoke_bar", "night_club"],
  ["karaoke_club", "night_club"],
  ["karaoke_studio", "night_club"],
]);

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calcDistanceMeters({ fromLat, fromLng, toLat, toLng }) {
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function normalizeType(rawType) {
  const type = String(rawType || "").trim().toLowerCase();
  if (!type) return null;
  if (TYPE_ALIASES.has(type)) return TYPE_ALIASES.get(type);
  if (SUPPORTED_NEARBY_TYPES.has(type)) return type;
  if (type.endsWith("_restaurant")) return "restaurant";
  if (type.endsWith("_bar")) return "bar";
  if (type.endsWith("_cafe")) return "cafe";
  return null;
}

function comparableTypes(types) {
  const seen = new Set();
  const result = [];

  (Array.isArray(types) ? types : []).forEach((rawType) => {
    const clean = String(rawType || "").trim().toLowerCase();
    if (!clean || GENERIC_PLACE_TYPES.has(clean)) return;
    const normalized = normalizeType(clean) ?? clean;
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function pickNearbySearchType(types) {
  return comparableTypes(types).find((type) => SUPPORTED_NEARBY_TYPES.has(type)) ?? null;
}

function reviewTolerance(reviewCount) {
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return 100;
  return Math.max(30, Math.min(150, Math.round(Number(reviewCount) * 0.35)));
}

function reviewClosenessScore(myReviewCount, candidateReviewCount) {
  if (!Number.isFinite(myReviewCount) || !Number.isFinite(candidateReviewCount)) return 0;
  const diff = Math.abs(Number(myReviewCount) - Number(candidateReviewCount));
  const tolerance = reviewTolerance(myReviewCount);
  if (diff <= tolerance) return 1;
  if (diff <= tolerance * 2) return 0.7;
  if (diff <= tolerance * 4) return 0.35;
  return 0;
}

function distanceScore(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return 0;
  if (distanceMeters <= 100) return 1;
  if (distanceMeters <= 250) return 0.9;
  if (distanceMeters <= 500) return 0.7;
  if (distanceMeters <= 800) return 0.45;
  if (distanceMeters <= 1200) return 0.25;
  return 0.1;
}

function typeMatchScore(candidateTypes, listingTypes) {
  const candidateComparableTypes = comparableTypes(candidateTypes);
  const listingComparableTypes = comparableTypes(listingTypes);
  if (!listingComparableTypes.length) {
    return {
      score: 0,
      candidateComparableTypes,
      listingComparableTypes,
    };
  }

  const listingSet = new Set(listingComparableTypes);
  const overlapCount = candidateComparableTypes.filter((type) => listingSet.has(type)).length;
  const score = overlapCount > 0 ? 2 + overlapCount : 0;

  return {
    score,
    candidateComparableTypes,
    listingComparableTypes,
  };
}

function rankCompetitors(results, { listingTypes, myReviewCount }) {
  const scored = (Array.isArray(results) ? results : []).map((item) => {
    const typeMatch = typeMatchScore(item?.types, listingTypes);
    const reviewCount = Number.isFinite(item?.user_ratings_total)
      ? Number(item.user_ratings_total)
      : null;
    const reviewGap = Number.isFinite(myReviewCount) && Number.isFinite(reviewCount)
      ? Math.abs(Number(myReviewCount) - reviewCount)
      : null;
    const reviewScore = reviewClosenessScore(myReviewCount, reviewCount);
    const distanceFit = distanceScore(item?.distance_meters);
    const competitiveFitScore = typeMatch.score * 3 + reviewScore * 2 + distanceFit;

    return {
      ...item,
      review_gap: reviewGap,
      review_tolerance: reviewTolerance(myReviewCount),
      type_match_score: typeMatch.score,
      listing_types: typeMatch.listingComparableTypes,
      comparable_types: typeMatch.candidateComparableTypes,
      competitive_fit_score: Number(competitiveFitScore.toFixed(3)),
    };
  });

  const matched = scored.filter((item) => item.type_match_score > 0);
  const pool = matched.length >= 4 ? matched : scored;

  return pool.sort((a, b) => {
    const fitDiff = (b.competitive_fit_score || 0) - (a.competitive_fit_score || 0);
    if (fitDiff !== 0) return fitDiff;

    const reviewGapA = Number.isFinite(a.review_gap) ? a.review_gap : Number.MAX_SAFE_INTEGER;
    const reviewGapB = Number.isFinite(b.review_gap) ? b.review_gap : Number.MAX_SAFE_INTEGER;
    if (reviewGapA !== reviewGapB) return reviewGapA - reviewGapB;

    const distanceA = Number.isFinite(a?.distance_meters) ? a.distance_meters : Number.MAX_SAFE_INTEGER;
    const distanceB = Number.isFinite(b?.distance_meters) ? b.distance_meters : Number.MAX_SAFE_INTEGER;
    return distanceA - distanceB || (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
  });
}

function mergeCompetitorResults(primary, fallback, { listingTypes, myReviewCount }) {
  const merged = [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])];
  const byPlaceId = new Map();

  merged.forEach((item) => {
    const placeId = item?.place_id;
    if (!placeId || byPlaceId.has(placeId)) return;
    byPlaceId.set(placeId, item);
  });

  return rankCompetitors([...byPlaceId.values()], { listingTypes, myReviewCount });
}

export async function fetchCompetitors({
  key,
  lat,
  lng,
  radius = 800,
  type = null,
  listingTypes = [],
  myReviewCount = null,
  lang = "en",
}) {
  const u =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
    `?location=${encodeURIComponent(`${lat},${lng}`)}` +
    `&radius=${encodeURIComponent(radius)}` +
    (type ? `&type=${encodeURIComponent(type)}` : "") +
    `&language=${encodeURIComponent(lang)}` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(u);

  if (res.status !== "OK" && res.status !== "ZERO_RESULTS") {
    return { status: res.status, error_message: res.error_message ?? null, results: [], searchType: type ?? null };
  }

  const rawResults = (res.results ?? []).map((p) => {
    const candidateLat = Number(p?.geometry?.location?.lat);
    const candidateLng = Number(p?.geometry?.location?.lng);

    return {
      place_id: p.place_id,
      name: p.name,
      rating: p.rating ?? null,
      user_ratings_total: p.user_ratings_total ?? 0,
      vicinity: p.vicinity ?? null,
      price_level: p.price_level ?? null,
      types: p.types ?? [],
      geometry: p.geometry ?? null,
      distance_meters: calcDistanceMeters({
        fromLat: lat,
        fromLng: lng,
        toLat: candidateLat,
        toLng: candidateLng,
      }),
    };
  });

  const results = rankCompetitors(rawResults, { listingTypes, myReviewCount }).slice(0, 10);

  return { status: res.status, results, searchType: type ?? null };
}

export async function fetchCompetitorsAutoRadius({
  key,
  lat,
  lng,
  type = null,
  listingTypes = [],
  myReviewCount = null,
  lang = "en",
  target = 12,
  tolerance = 3,
  minR = 300,
  maxR = 3000,
  initialR = 800,
  maxTries = 4,
}) {
  const searchType = type ?? pickNearbySearchType(listingTypes);
  let r = initialR;
  let last = null;

  for (let i = 0; i < maxTries; i++) {
    const usedRadius = Math.round(r);
    const primary = await fetchCompetitors({
      key,
      lat,
      lng,
      radius: usedRadius,
      type: searchType,
      listingTypes,
      myReviewCount,
      lang,
    });
    let combined = primary;

    if (
      searchType &&
      (primary.status === "OK" || primary.status === "ZERO_RESULTS") &&
      primary.results.length < 4
    ) {
      const broader = await fetchCompetitors({
        key,
        lat,
        lng,
        radius: usedRadius,
        type: null,
        listingTypes,
        myReviewCount,
        lang,
      });

      if (broader.status === "OK" || broader.status === "ZERO_RESULTS") {
        combined = {
          ...primary,
          results: mergeCompetitorResults(primary.results, broader.results, {
            listingTypes,
            myReviewCount,
          }),
          broadenedSearch: true,
        };
      }
    }

    last = { ...combined, usedRadius, tries: i + 1 };

    if (combined.status !== "OK" && combined.status !== "ZERO_RESULTS") return last;

    const n = combined.results.length;
    if (Math.abs(n - target) <= tolerance) return last;

    const ratio = target / Math.max(n, 1);
    const next = r * Math.sqrt(ratio);

    const nextClamped = clamp(next, minR, maxR);
    if (Math.round(nextClamped) === usedRadius) {
      return { ...last, meta: { reason: "NO_RADIUS_CHANGE" } };
    }

    r = nextClamped;
  }

  return last ?? {
    status: "UNKNOWN",
    results: [],
    searchType,
    usedRadius: Math.round(r),
    tries: maxTries,
  };
}
