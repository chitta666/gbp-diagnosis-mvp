import { resolvePlaceIdFromQuery, buildListingReport } from "../_lib/report.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const publicError = (code, message, status = 400) =>
    json({ ok: false, code, message }, status);

  try {
    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return publicError(
        "SERVICE_UNAVAILABLE",
        "The analysis service is temporarily unavailable.",
        500
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return publicError("BAD_INPUT", "Enter a business name and address.", 400);
    }

    const resolved = await resolvePlaceIdFromQuery({ key, q });
    if (!resolved.ok) {
      return publicError(resolved.code, resolved.message, 404);
    }

    const report = await buildListingReport({ key, placeId: resolved.placeId });
    if (!report.ok) {
      return publicError(report.code, report.message, 400);
    }

    return json(report);
  } catch (e) {
    console.error("diagnose failed", e);
    return publicError(
      "INTERNAL_ERROR",
      "Something went wrong while analyzing this listing. Please try again.",
      500
    );
  }
}
