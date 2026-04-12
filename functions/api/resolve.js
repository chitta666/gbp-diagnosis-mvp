import {
  mapGooglePlacesApiError,
  mapGooglePlacesTransportError,
} from "../_lib/utils.js";
import { resolveRequestLanguage } from "../_lib/i18n.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { lang } = resolveRequestLanguage({ request, fallback: "en" });

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  const query = (url.searchParams.get("query") || "").trim();
  if (!query) return json({ error: "query is required" }, 400);

  // 1) URLっぽいなら最終URLへ
  let final = query;
  if (looksLikeUrl(query)) final = await expandUrl(query);

  // 2) place_id 抜く
  let placeId = extractPlaceId(final);

  // 3) なければ findplacefromtext
  if (!placeId) {
    const text = looksLikeUrl(final) ? extractPlaceText(final) : query;
    if (!text) return json({ error: "Place text not found. 店名+住所でもOK" }, 400);
    const resolved = await findPlaceIdFromText(text, key, lang);
    if (!resolved.ok) {
      return json(
        {
          ok: false,
          error: resolved.code,
          code: resolved.code,
          message: resolved.message,
          hint: resolved.hint,
          upstreamStatus: resolved.upstreamStatus,
          upstreamErrorMessage: resolved.upstreamErrorMessage ?? null,
        },
        resolved.httpStatus
      );
    }
    placeId = resolved.placeId;
  }
  if (!placeId) {
    return json(
      {
        ok: false,
        error: "PLACE_NOT_FOUND",
        code: "PLACE_NOT_FOUND",
        message: "We couldn't find that business. Try the business name with the full address.",
        hint: "Try the business name with the full address.",
      },
      404
    );
  }

  // 4) nameだけ取る（軽く）
  let detailsRes;
  try {
    detailsRes = await fetchJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        placeId
      )}&fields=name,formatted_address&language=${encodeURIComponent(lang)}&key=${encodeURIComponent(key)}`
    );
  } catch (error) {
    const mapped = mapGooglePlacesTransportError(error);
    return json(
      {
        ok: false,
        error: mapped.code,
        code: mapped.code,
        message: mapped.message,
        hint: mapped.hint,
        upstreamStatus: mapped.upstreamStatus,
        upstreamErrorMessage: mapped.upstreamErrorMessage,
      },
      mapped.httpStatus
    );
  }

  const detailsError = mapGooglePlacesApiError({
    status: detailsRes?.status,
    errorMessage: detailsRes?.error_message,
  });
  if (detailsError || detailsRes.status !== "OK") {
    return json(
      {
        ok: false,
        error: detailsError?.code || "PLACE_DETAILS_FAILED",
        code: detailsError?.code || "PLACE_DETAILS_FAILED",
        message:
          detailsError?.message || "We couldn't load the business details for that listing.",
        hint: detailsError?.hint || "Check the Google Maps project configuration for this API key.",
        upstreamStatus: detailsError?.upstreamStatus ?? detailsRes?.status ?? null,
        upstreamErrorMessage:
          detailsError?.upstreamErrorMessage ?? detailsRes?.error_message ?? null,
      },
      detailsError?.httpStatus || 502
    );
  }

  const details = detailsRes.result ?? {};
  return json(
    {
      placeId,
      name: details?.name ?? null,
      address: details?.formatted_address ?? null,
      // デバッグ：必要なら残す、不要なら消す
      // details,
    },
    200
  );
}

/** ========= util ========= */
function looksLikeUrl(s) {
  return /^https?:\/\//i.test(s);
}

async function expandUrl(u) {
  try {
    const res = await fetch(u, { redirect: "follow" });
    return res.url || u;
  } catch {
    return u;
  }
}

function extractPlaceId(u) {
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

function extractPlaceText(u) {
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

async function findPlaceIdFromText(text, key, lang = "en") {
  const endpoint =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(text)}` +
    `&inputtype=textquery` +
    `&fields=place_id` +
    `&language=${encodeURIComponent(lang)}` +
    `&key=${encodeURIComponent(key)}`;

  let r;
  try {
    r = await fetchJson(endpoint);
  } catch (error) {
    return {
      ok: false,
      ...mapGooglePlacesTransportError(error),
    };
  }

  const mapped = mapGooglePlacesApiError({
    status: r?.status,
    errorMessage: r?.error_message,
  });
  if (mapped) {
    return {
      ok: false,
      ...mapped,
    };
  }

  if (r.candidates?.length) {
    return {
      ok: true,
      placeId: r.candidates[0].place_id,
    };
  }

  return {
    ok: false,
    code: "PLACE_NOT_FOUND",
    message: "We couldn't find that business. Try the business name with the full address.",
    hint: "Try the business name with the full address.",
    httpStatus: 404,
    upstreamStatus: r?.status ?? null,
    upstreamErrorMessage: r?.error_message ?? null,
  };
}

async function fetchJson(u) {
  const res = await fetch(u);
  return await res.json();
}
