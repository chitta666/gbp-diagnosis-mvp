export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const KV = env?.KV;
  if (!KV) return json({ ok: false, error: "NO_KV_BINDING" }, 500);

  const url = new URL(request.url);
  const myPlaceId = (url.searchParams.get("my") || "").trim();

  if (!myPlaceId) {
    return json({ ok: false, error: "my required" }, 400);
  }

  const key = `comp:${myPlaceId}`;
  const raw = await KV.get(key);

  if (!raw) {
    return json({ ok: false, error: "NOT_SET" }, 404);
  }

  const data = JSON.parse(raw);

  return json({
    ok: true,
    myPlaceId,
    competitorPlaceId: data.competitorPlaceId,
    setAt: data.setAt,
  });
}