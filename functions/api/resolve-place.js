import {
  fetchJson,
  mapGooglePlacesApiError,
  mapGooglePlacesTransportError,
} from "../_lib/utils.js";

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  const address = (url.searchParams.get("address") || "").trim();

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (!name || !address) {
    return json(
      {
        ok: false,
        error: "BAD_INPUT",
        code: "BAD_INPUT",
        message: "name and address are required",
        hint: "Provide both the business name and the address.",
      },
      400
    );
  }

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ ok: false, error: "NO_KEY" }, 500);

  const input = `${name} ${address}`;

  const apiUrl =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery` +
    `&fields=place_id,name,formatted_address` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  let res;
  try {
    res = await fetchJson(apiUrl);
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

  const mapped = mapGooglePlacesApiError({
    status: res?.status,
    errorMessage: res?.error_message,
  });
  if (mapped) {
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

  if (!res.candidates?.length) {
    return json(
      {
        ok: false,
        error: "PLACE_NOT_FOUND",
        code: "PLACE_NOT_FOUND",
        message: "We couldn't find that business. Try the business name with the full address.",
        hint: "Try the business name with the full address.",
        upstreamStatus: res?.status ?? null,
        upstreamErrorMessage: res?.error_message ?? null,
      },
      404
    );
  }

  const c = res.candidates[0];

  return json({
    ok: true,
    placeId: c.place_id,
    name: c.name ?? null,
    address: c.formatted_address ?? null,
  });
}
