export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const input = (url.searchParams.get("url") || "").trim();

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (!input) return json({ error: "url parameter is required" }, 400);

  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  // 1) 入力がURLっぽいなら最終URLへ
  let final = input;
  if (looksLikeUrl(input)) final = await expandUrl(input);

  // 2) place_id 抜く
  let placeId = extractPlaceId(final);

  // 3) なければ findplacefromtext
  if (!placeId) {
    const text = looksLikeUrl(final) ? extractPlaceText(final) : input;
    if (!text) return json({ error: "Place ID could not be extracted. 店名+住所 でもOK。" }, 400);
    placeId = await findPlaceIdFromText(text, key);
  }
  if (!placeId) return json({ error: "Could not resolve place_id. 店名+住所で試して。" }, 400);

  // 4) Details
const detailsRes = await fetchJson(
  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=name,rating,user_ratings_total,formatted_address,international_phone_number,website,opening_hours,photos,geometry&key=${encodeURIComponent(
    key
  )}`
);

  if (detailsRes.status !== "OK") {
    return json({ error: "Place Details failed", detailsRes }, 400);
  }
  // ★ 返却はこれで固定（フロントもこれ前提にする）
const details = detailsRes.result ?? {};
const diagnosis = buildDiagnosis(details);
diagnosis.competitors = competitors;
return json({ placeId, details, diagnosis }, 200);

}

/** ========= 診断はこれ1個だけ ========= */
function buildDiagnosis(details) {
  const missing = [];
  const todos = [];

  const rules = [
    { id: "phone",   weight: 30, isMissing: (d) => !d?.international_phone_number, todo: "電話番号が未設定（または取得不可）" },
    { id: "website", weight: 20, isMissing: (d) => !d?.website,                    todo: "Webサイトが未設定" },
    { id: "photos",  weight: 10, isMissing: (d) => (d?.photos?.length ?? 0) < 5,    todo: "写真が少ない（目安: 5枚以上）" },
  ];

  let penalty = 0;

  for (const r of rules) {
    if (r.isMissing(details)) {
      missing.push(r.id);
      todos.push(r.todo);
      penalty += r.weight;
    }
  }

return {
  version: "buildDiagnosis_v2",
  marker: "DBG_20260214_A",
  score: Math.max(0, 100 - penalty),
  todos,
  missing,
  penalty,
  breakdown: rules.map((r) => ({
    id: r.id,
    weight: r.weight,
    missing: r.isMissing(details),
  })),
};
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
    `&locationbias=circle:50000@35.6895,139.6917` +
    `&key=${encodeURIComponent(key)}`;

  const r = await fetchJson(endpoint);
  if (r.status === "OK" && r.candidates?.length) return r.candidates[0].place_id;
  return null;
}

async function fetchJson(u) {
  const res = await fetch(u);
  return await res.json();
}
