export async function onRequest(context) {
  let json;

  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const input = (url.searchParams.get("url") || "").trim();

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    };

    json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), { status, headers });

    if (!input) return json({ error: "url parameter is required" }, 400);

    const key = env.GOOGLE_MAPS_API_KEY;
    if (!key) return json({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

    let final = input;
    if (looksLikeUrl(input)) final = await expandUrl(input);

    let placeId = extractPlaceId(final);

    if (!placeId) {
      const text = looksLikeUrl(final) ? extractPlaceText(final) : input;
      if (!text) return json({ error: "Place ID could not be extracted. 店名+住所 でもOK。" }, 400);
      placeId = await findPlaceIdFromText(text, key);
    }
    if (!placeId) return json({ error: "Could not resolve place_id. 店名+住所で試して。" }, 400);

    const detailsRes = await fetchJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,formatted_address,international_phone_number,website,opening_hours,photos,geometry&key=${encodeURIComponent(key)}`
    );

    if (detailsRes.status !== "OK") {
      return json({ error: "Place Details failed", detailsRes }, 400);
    }

    const details = detailsRes.result ?? {};

    const loc = details?.geometry?.location;
const competitors =
  (loc?.lat != null && loc?.lng != null)
    ? await fetchCompetitors({ key, lat: loc.lat, lng: loc.lng, radius: 800, type: "restaurant" })
    : { status: "NO_GEO", results: [] };

const diagnosis = buildDiagnosis(details, competitors);

// ✅ competitors をトップレベルに追加
return json({ placeId, details, diagnosis, competitors }, 200);

    return json({ placeId, details, diagnosis }, 200);
  } catch (e) {
    // jsonが未初期化でも落ちないようにフォールバック
    if (!json) {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      };
      return new Response(
        JSON.stringify({ error: "Unhandled exception", message: String(e?.message ?? e), stack: String(e?.stack ?? "") }, null, 2),
        { status: 500, headers }
      );
    }

    return json(
      {
        error: "Unhandled exception",
        message: String(e?.message ?? e),
        stack: String(e?.stack ?? ""),
      },
      500
    );
  }
}

function analyzeCompetitors(competitors) {
  if (!competitors || competitors.status !== "OK") {
    return { penalty: 0, strongCount: null, todo: "競合データ取得失敗のため競合評価はスキップ" };
  }

  const list = competitors.results ?? [];
  const strongCount = list.filter((p) => (p.rating ?? 0) >= 4.2 && (p.user_ratings_total ?? 0) >= 200).length;

  let penalty = 0;
  if (strongCount === 1) penalty = 5;
  else if (strongCount === 2) penalty = 10;
  else if (strongCount === 3) penalty = 15;
  else if (strongCount >= 4) penalty = 20;

  const todo =
    penalty === 0
      ? "近隣の強い競合は少なめ"
      : `近隣に強い競合が${strongCount}件（評価4.2+ & 口コミ200+）`;

  return { penalty, strongCount, todo };
}

async function fetchCompetitors({ key, lat, lng, radius = 800, type = "restaurant" }) {
  const u =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${encodeURIComponent(`${lat},${lng}`)}` +
    `&radius=${encodeURIComponent(radius)}` +
    `&type=${encodeURIComponent(type)}` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetchJson(u);

if (res.status !== "OK" && res.status !== "ZERO_RESULTS") {
  return { status: res.status, error_message: res.error_message ?? null, results: [] };
}

  const results = (res.results ?? []).slice(0, 10).map((p) => ({
    place_id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    user_ratings_total: p.user_ratings_total ?? 0,
    vicinity: p.vicinity ?? null,
    price_level: p.price_level ?? null,
    types: p.types ?? [],
  }));

  return { status: res.status, results };
}

/** ========= 診断はこれ1個だけ ========= */
function buildDiagnosis(details, competitors) {
const missing = [];
  const todos = [];

  const comp = analyzeCompetitors(competitors);

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

// 競合は missing ではなく環境要因
let environment = [];
let competitorsPenalty = 0;

if (comp.penalty > 0) {
  environment.push(comp.todo);
  competitorsPenalty = comp.penalty;
}

// competitors 分を加算
penalty += competitorsPenalty;

return {
  version: "buildDiagnosis_v2",
  score: Math.max(0, 100 - penalty),
  todos,
  missing,
  penalty,
  breakdown: rules.map((r) => ({
    id: r.id,
    weight: r.weight,
    missing: r.isMissing(details),
  })),
  competitorsAnalysis: comp,
  environment,
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
    `&key=${encodeURIComponent(key)}`;

  const r = await fetchJson(endpoint);
  if (r.status === "OK" && r.candidates?.length) return r.candidates[0].place_id;
  return null;
}

async function fetchJson(u) {
  const res = await fetch(u);
  return await res.json();
}
