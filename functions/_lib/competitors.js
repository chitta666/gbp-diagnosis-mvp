import { fetchJson, clamp } from "./utils.js";

export async function fetchCompetitors({ key, lat, lng, radius = 800, type = "restaurant" }) {
  const u =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
    `?location=${encodeURIComponent(`${lat},${lng}`)}` +
    `&radius=${encodeURIComponent(radius)}` +
    `&type=${encodeURIComponent(type)}` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(u);

  if (res.status !== "OK" && res.status !== "ZERO_RESULTS") {
    return { status: res.status, error_message: res.error_message ?? null, results: [] };
  }

  const results = (res.results ?? []).slice(0, 10).map((p) => ({
    place_id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    user_ratings_total: p.user_ratings_total ?? 0,
    vicinity: p.vicinity ?? null,
    price_level: p.price_level ?? null,
    types: p.types ?? [],
  }));

  return { status: res.status, results };
}

export async function fetchCompetitorsAutoRadius({
  key, lat, lng,
  type = "restaurant",
  target = 12,
  tolerance = 3,
  minR = 300,
  maxR = 3000,
  initialR = 800,
  maxTries = 4,
}) {
  let r = initialR;
  let last = null;

  for (let i = 0; i < maxTries; i++) {
    const usedRadius = Math.round(r);
    const res = await fetchCompetitors({ key, lat, lng, radius: usedRadius, type });
    last = { ...res, usedRadius, tries: i + 1 };

    if (res.status !== "OK" && res.status !== "ZERO_RESULTS") return last;

    const n = res.results.length;
    if (Math.abs(n - target) <= tolerance) return last;

    const ratio = target / Math.max(n, 1);
    const next = r * Math.sqrt(ratio);

    const nextClamped = clamp(next, minR, maxR);
    if (Math.round(nextClamped) === usedRadius) return { ...last, meta: { reason: "NO_RADIUS_CHANGE" } };

    r = nextClamped;
  }

  return last ?? { status: "UNKNOWN", results: [], usedRadius: Math.round(r), tries: maxTries };
}