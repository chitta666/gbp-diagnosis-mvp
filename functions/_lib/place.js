import { fetchJson } from "./utils.js";

export function extractPlaceId(u) {
  try {
    const x = new URL(u);
    const pid = x.searchParams.get("place_id");
    if (pid) return pid;
  } catch {}
  const m =
    u.match(/[?&]place_id=([^&]+)/i) ||
    u.match(/place_id[:=]%3A?([A-Za-z0-9_-]+)/i) ||
    u.match(/place_id[:=]([A-Za-z0-9_-]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

// functions/_lib/place.js
import { fetchJson } from "./utils.js";

export async function fetchPlaceDetails({ key, placeId }) {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=name,formatted_address,rating,user_ratings_total` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(url);

  if (res.status !== "OK") {
    return { ok: false, status: res.status, error_message: res.error_message ?? null, raw: res };
  }

  const r = res.result ?? {};
  return {
    ok: true,
    placeId,
    name: r.name ?? null,
    address: r.formatted_address ?? null,
    rating: r.rating ?? null,
    user_ratings_total: r.user_ratings_total ?? 0,
  };
}

export function extractPlaceText(u) {
  try {
    const x = new URL(u);
    const m = x.pathname.match(/\/maps\/place\/([^/]+)/);
    if (m?.[1]) return decodeURIComponent(m[1]).replace(/\+/g, " ");
    const q = x.searchParams.get("q");
    if (q) return q;
    const query = x.searchParams.get("query");
    if (query) return query;
  } catch {}
  return null;
}

export async function findPlaceIdFromText(text, key) {
  const endpoint =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(text)}` +
    `&inputtype=textquery` +
    `&fields=place_id` +
    `&key=${encodeURIComponent(key)}`;

  const r = await fetchJson(endpoint);
  if (r.status === "OK" && r.candidates?.length) return r.candidates[0].place_id;
  return null;
}