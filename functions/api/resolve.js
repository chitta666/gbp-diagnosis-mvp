export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

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
    placeId = await findPlaceIdFromText(text, key);
  }
  if (!placeId) return json({ error: "Could not resolve place_id" }, 400);

  // 4) nameだけ取る（軽く）
  const detailsRes = await fetchJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=name,formatted_address&language=ja&key=${encodeURIComponent(key)}`
  );

  if (detailsRes.status !== "OK") {
    return json({ error: "Place Details failed", detailsRes }, 400);
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

async function findPlaceIdFromText(text, key) {
  const endpoint =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(text)}` +
    `&inputtype=textquery` +
    `&fields=place_id` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const r = await fetchJson(endpoint);
  if (r.status === "OK" && r.candidates?.length) return r.candidates[0].place_id;
  return null;
}

async function fetchJson(u) {
  const res = await fetch(u);
  return await res.json();
}