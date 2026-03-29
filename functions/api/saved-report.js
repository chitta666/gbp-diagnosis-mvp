import { buildListingReport } from "../_lib/report.js";
import { getSavedListing, publicSavedListing } from "../_lib/savedListings.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const KV = env?.KV;
  if (!KV) return json({ ok: false, error: "NO_KV_BINDING" }, 500);

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ ok: false, error: "NO_KEY" }, 500);

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();

  if (!id) {
    return json({ ok: false, error: "id required" }, 400);
  }

  const saved = await getSavedListing(KV, id);
  if (!saved) {
    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }

  if (saved?.competitorPlaceId) {
    await KV.put(
      `comp:${saved.placeId}`,
      JSON.stringify({
        competitorPlaceId: saved.competitorPlaceId,
        setAt: Date.now(),
      })
    );
  }

  const report = await buildListingReport({ key, placeId: saved.placeId });
  if (!report.ok) {
    return json({ ok: false, error: report.code, message: report.message }, 400);
  }

  return json({
    ...report,
    generatedAt: new Date().toISOString(),
    defaultCompetitorPlaceId:
      saved.competitorPlaceId || report.defaultCompetitorPlaceId || null,
    recommendedCompetitorPlaceId: report.defaultCompetitorPlaceId || null,
    savedListing: publicSavedListing(saved, {
      origin: url.origin,
    }),
  });
}
