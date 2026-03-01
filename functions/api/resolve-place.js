import { fetchJson } from "../_lib/utils.js";

function mapErrorStatus(status) {
  if (status === "ZERO_RESULTS") return { error: "NOT_FOUND", hint: "店名+住所で入力して" };
  if (status === "REQUEST_DENIED") return { error: "API_DENIED", hint: "APIキーの権限/請求/制限を確認して" };
  if (status === "OVER_QUERY_LIMIT") return { error: "OVER_LIMIT", hint: "呼び出し回数が上限。時間をおいて再試行" };
  return { error: "UNKNOWN", hint: "入力を変えて再試行して" };
}

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
    return json({ ok: false, error: "BAD_INPUT", hint: "name と address が必要" }, 400);
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

  const res = await fetchJson(apiUrl);

  if (res.status !== "OK" || !res.candidates?.length) {
    const mapped = mapErrorStatus(res.status);
    return json(
      { ok: false, ...mapped, status: res.status },
      400
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