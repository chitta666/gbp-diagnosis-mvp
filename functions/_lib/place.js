import { fetchJson } from "./utils.js";

export async function fetchPlaceDetails({ key, placeId }) {
  if (!key) {
    return {
      ok: false,
      error: "NO_KEY",
      placeId: placeId ?? null,
      name: null,
      address: null,
      rating: null,
      user_ratings_total: null,
      raw: null,
    };
  }

  if (!placeId) {
    return {
      ok: false,
      error: "NO_PLACE_ID",
      placeId: null,
      name: null,
      address: null,
      rating: null,
      user_ratings_total: null,
      raw: null,
    };
  }

  const apiUrl =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=place_id,name,formatted_address,international_phone_number,website,photos,rating,user_ratings_total,geometry` +
    `&language=en` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(apiUrl);

  if (res.status !== "OK" || !res.result) {
    return {
      ok: false,
      error: "PLACE_DETAILS_FAILED",
      status: res.status ?? null,
      placeId,
      name: null,
      address: null,
      rating: null,
      user_ratings_total: null,
      raw: res,
    };
  }

  const r = res.result;

  return {
    ok: true,
    place_id: r.place_id ?? placeId,
    placeId: r.place_id ?? placeId,
    name: r.name ?? null,
    formatted_address: r.formatted_address ?? null,
    address: r.formatted_address ?? null,
    international_phone_number: r.international_phone_number ?? null,
    website: r.website ?? null,
    photos: Array.isArray(r.photos) ? r.photos : [],
    rating: Number.isFinite(r.rating) ? r.rating : null,
    user_ratings_total: Number.isFinite(r.user_ratings_total) ? r.user_ratings_total : null,
    geometry: r.geometry ?? null,
    raw: r,
  };
}
