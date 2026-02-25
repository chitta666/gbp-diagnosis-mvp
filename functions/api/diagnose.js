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

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "lat & lng are required (number)" }, 400);
  }

  const competitors = await fetchCompetitorsAutoRadius({
    key,
    lat,
    lng,
    type: "restaurant",
  });

  const radius = competitors.usedRadius ?? 800;
  const count = competitors?.results?.length ?? 0;

  const areaKm2 = Math.PI * Math.pow(radius / 1000, 2);
  const density = areaKm2 > 0 ? count / areaKm2 : 0;

  const marketScore = clamp(Math.round(100 - density * 5), 0, 100);

  return json(
    {
      lat,
      lng,
      usedRadius: radius,
      competitorsCount: count,
      densityPerKm2: round2(density),
      marketScore,
      topCompetitors: (competitors.results ?? []).slice(0, 5),
      competitors,
    },
    200
  );
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

async function fetchJson(u) {
  const res = await fetch(u);
  return await res.json();
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// これもあなたのままでOK（clampは上の1個を使う）
async function fetchCompetitorsAutoRadius({
  key,
  lat,
  lng,
  type = "restaurant",
  target = 12,
  tolerance = 3,
  minR = 300,
  maxR = 3000,
  initialR = 800,
  maxTries = 4,
}) {
  let r = initialR;
  let last = null;

  for (let i = 0; i < maxTries; i++) {
    const usedRadius = Math.round(r);
    const res = await fetchCompetitors({ key, lat, lng, radius: usedRadius, type });
    last = { ...res, usedRadius, tries: i + 1 };

    if (res.status !== "OK" && res.status !== "ZERO_RESULTS") return last;

    const n = res.results.length;
    if (Math.abs(n - target) <= tolerance) return last;

    const ratio = target / Math.max(n, 1);
    const next = r * Math.sqrt(ratio);

    const nextClamped = clamp(next, minR, maxR);
    if (Math.round(nextClamped) === usedRadius) return { ...last, meta: { reason: "NO_RADIUS_CHANGE" } };

    r = nextClamped;
  }

  return last ?? { status: "UNKNOWN", results: [], usedRadius: Math.round(r), tries: maxTries };
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

async function fetchCompetitors({ key, lat, lng, radius = 30, type = "restaurant" }) {
  const url =
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
    `?location=${encodeURIComponent(`${lat},${lng}`)}` +
    `&radius=${encodeURIComponent(radius)}` +
    `&type=${encodeURIComponent(type)}` +
    `&language=ja` +
    `&key=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return { status: data.status, error_message: data.error_message ?? null, results: [] };
  }

  return {
    status: data.status,
    results: (data.results ?? []).slice(0, 10),
  };
}
