import { resolvePlaceIdFromQuery, buildListingReport } from "../_lib/report.js";

function resolveLang(request, url) {
  const explicit = (url.searchParams.get("lang") || "").trim().toLowerCase();
  if (explicit === "ja" || explicit === "en") return explicit;

  const acceptLanguage = String(request.headers.get("accept-language") || "").toLowerCase();
  return acceptLanguage.includes("ja") ? "ja" : "en";
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const publicError = (code, message, status = 400, extra = {}) =>
    json(
      {
        ok: false,
        code,
        message,
        ...extra,
      },
      status
    );

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
    const lang = resolveLang(request, url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return publicError("BAD_INPUT", "Enter a business name and address.", 400);
    }

    const resolved = await resolvePlaceIdFromQuery({ key, q });
    if (!resolved.ok) {
      console.error("diagnose resolve failed", {
        q,
        code: resolved.code,
        upstreamStatus: resolved.upstreamStatus ?? null,
        upstreamErrorMessage: resolved.upstreamErrorMessage ?? null,
      });
      return publicError(resolved.code, resolved.message, resolved.httpStatus ?? 404, {
        hint: resolved.hint ?? null,
        upstreamStatus: resolved.upstreamStatus ?? null,
        upstreamErrorMessage: resolved.upstreamErrorMessage ?? null,
      });
    }

    const report = await buildListingReport({ key, placeId: resolved.placeId, lang });
    if (!report.ok) {
      console.error("diagnose build report failed", {
        q,
        placeId: resolved.placeId,
        code: report.code,
        upstreamStatus: report.upstreamStatus ?? null,
        upstreamErrorMessage: report.upstreamErrorMessage ?? null,
      });
      return publicError(report.code, report.message, report.httpStatus ?? 400, {
        hint: report.hint ?? null,
        upstreamStatus: report.upstreamStatus ?? null,
        upstreamErrorMessage: report.upstreamErrorMessage ?? null,
      });
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
