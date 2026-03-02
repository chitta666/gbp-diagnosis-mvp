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
  const competitorPlaceId = (url.searchParams.get("competitor") || "").trim();

  if (!myPlaceId || !competitorPlaceId) {
    return json({ ok: false, error: "my & competitor required" }, 400);
  }

  const key = `comp:${myPlaceId}`;

  await KV.put(
    key,
    JSON.stringify({
      competitorPlaceId,
      setAt: Date.now(),
    })
  );

  return json({
    ok: true,
    storedKey: key,
    competitorPlaceId,
  });
}