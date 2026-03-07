import { fetchPlaceDetails } from "./place.js";
import { ymdTokyo } from "./date.js";

export async function saveSnapshot({ KV, key, placeId }) {
  const info = await fetchPlaceDetails({ key, placeId });

  if (!info.ok) {
    return {
      ok: false,
      placeId,
      error: "PLACE_DETAILS_FAILED",
      info,
    };
  }

  const today = ymdTokyo();
  const snapKey = `snap:${placeId}:${today}`;

  const payload = {
    ts: Date.now(),
    date: today,
    placeId,
    name: info.name ?? null,
    address: info.address ?? null,
    rating: info.rating ?? null,
    user_ratings_total: info.user_ratings_total ?? null,
  };

  await KV.put(snapKey, JSON.stringify(payload));

  return {
    ok: true,
    snapKey,
    payload,
  };
}