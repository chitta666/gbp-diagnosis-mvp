import { fetchJson } from "../_lib/utils.js";

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
    return json({ error: "name & address are required" }, 400);
  }

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  const input = `${name} ${address}`;

  const apiUrl =
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery` +
    `&fields=place_id,name,formatted_address` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(apiUrl);

  if (res.status !== "OK" || !res.candidates?.length) {
    return json(
      { error: "Could not resolve place_id", status: res.status, raw: res },
      400
    );
  }

  const c = res.candidates[0];

  return json({
    ok: true,
    placeId: c.place_id,
    name: c.name,
    address: c.formatted_address,
  });
}