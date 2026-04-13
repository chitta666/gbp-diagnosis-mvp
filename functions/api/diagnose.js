import { resolvePlaceIdFromQuery, buildListingReport } from "../_lib/report.js";
import { resolveRequestLanguage } from "../_lib/i18n.js";

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
    const { lang } = resolveRequestLanguage({ request, fallback: "en" });
    if (!key) {
      return publicError(
        "SERVICE_UNAVAILABLE",
        t(
          lang,
          "The analysis service is temporarily unavailable.",
          "現在、分析サービスを一時的に利用できません。"
        ),
        500
      );
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      return publicError(
        "BAD_INPUT",
        t(lang, "Enter a business name and address.", "店舗名と住所を入力してください。"),
        400
      );
    }

    const resolved = await resolvePlaceIdFromQuery({ key, q, lang });
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
      t(
        lang,
        "Something went wrong while analyzing this listing. Please try again.",
        "店舗の分析中に問題が発生しました。もう一度お試しください。"
      ),
      500
    );
  }
}
