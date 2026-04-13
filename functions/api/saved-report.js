import { buildListingReport } from "../_lib/report.js";
import { resolveRequestLanguage } from "../_lib/i18n.js";
import { getSavedListing, publicSavedListing } from "../_lib/savedListings.js";

function t(lang, en, ja) {
  return lang === "ja" ? ja : en;
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  const { lang } = resolveRequestLanguage({ request, fallback: "en" });

  const KV = env?.KV;
  if (!KV) {
    return json(
      { ok: false, error: "NO_KV_BINDING", message: t(lang, "KV binding is not configured.", "KV バインディングが設定されていません。") },
      500
    );
  }

  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return json(
      { ok: false, error: "NO_KEY", message: t(lang, "Google Maps API key is not configured.", "Google Maps API キーが設定されていません。") },
      500
    );
  }

  if (!id) {
    return json(
      { ok: false, error: "ID_REQUIRED", message: t(lang, "id is required.", "id が必要です。") },
      400
    );
  }

  const saved = await getSavedListing(KV, id);
  if (!saved) {
    return json(
      { ok: false, error: "NOT_FOUND", message: t(lang, "Saved report not found.", "保存済みレポートが見つかりません。") },
      404
    );
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

  const report = await buildListingReport({ key, placeId: saved.placeId, lang });
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
      lang,
    }),
  });
}
