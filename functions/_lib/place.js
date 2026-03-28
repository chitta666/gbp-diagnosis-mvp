import {
  fetchJson,
  mapGooglePlacesApiError,
  mapGooglePlacesTransportError,
} from "./utils.js";

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
    `&fields=place_id,name,formatted_address,international_phone_number,website,photos,rating,user_ratings_total,geometry,types` +
    `&language=en` +
    `&key=${encodeURIComponent(key)}`;

  let res;
  try {
    res = await fetchJson(apiUrl);
  } catch (error) {
    const mappedError = mapGooglePlacesTransportError(error);
    return {
      ok: false,
      error: mappedError.code,
      code: mappedError.code,
      message: mappedError.message,
      hint: mappedError.hint,
      httpStatus: mappedError.httpStatus,
      status: null,
      upstreamStatus: mappedError.upstreamStatus,
      upstreamErrorMessage: mappedError.upstreamErrorMessage,
      placeId,
      name: null,
      address: null,
      rating: null,
      user_ratings_total: null,
      raw: null,
    };
  }

  const mappedError = mapGooglePlacesApiError({
    status: res?.status,
    errorMessage: res?.error_message,
  });

  if (mappedError || !res.result) {
    return {
      ok: false,
      error: mappedError?.code || "PLACE_DETAILS_FAILED",
      code: mappedError?.code || "PLACE_DETAILS_FAILED",
      message:
        mappedError?.message || "We couldn't load the business details for that listing.",
      hint: mappedError?.hint || "Check the Google Maps project configuration for this API key.",
      httpStatus: mappedError?.httpStatus || 502,
      status: res?.status ?? null,
      upstreamStatus: mappedError?.upstreamStatus ?? res?.status ?? null,
      upstreamErrorMessage: mappedError?.upstreamErrorMessage ?? res?.error_message ?? null,
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
    types: Array.isArray(r.types) ? r.types : [],
    raw: r,
  };
}
