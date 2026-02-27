import comp from "../_lib/competitors.js";

export async function onRequest(context) {
  const { request, env } = context;

  const key = env?.GOOGLE_MAPS_API_KEY;
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  const competitors =
    await comp.fetchCompetitorsAutoRadius({ key, lat, lng });

  return new Response(
    JSON.stringify(competitors, null, 2),
    { headers: { "content-type": "application/json" } }
  );
}