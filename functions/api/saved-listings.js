import { runDailyForPlace } from "../_lib/runDaily.js";
import { resolveRequestLanguage } from "../_lib/i18n.js";
import { getWeeklyReport } from "../_lib/weeklyReport.js";
import {
  deleteSavedListing,
  ensureSavedListingMetrics,
  isValidEmail,
  listSavedListingsByEmail,
  publicSavedListing,
  refreshSavedListingMetrics,
  upsertSavedListing,
} from "../_lib/savedListings.js";

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

  const origin = new URL(request.url).origin;
  const url = new URL(request.url);
  const { lang } = resolveRequestLanguage({ request, fallback: "en" });
  const KV = env?.KV;
  if (!KV) {
    return json(
      { ok: false, error: "NO_KV_BINDING", message: t(lang, "KV binding is not configured.", "KV バインディングが設定されていません。") },
      500
    );
  }

  if (request.method === "GET") {
    const email = (url.searchParams.get("email") || "").trim();
    if (!isValidEmail(email)) {
      return json(
        {
          ok: false,
          error: "VALID_EMAIL_REQUIRED",
          message: t(lang, "Enter a valid email address.", "有効なメールアドレスを入力してください。"),
        },
        400
      );
    }

    let listings = await listSavedListingsByEmail({ KV, email });
    if (env?.GOOGLE_MAPS_API_KEY) {
      listings = await Promise.all(
        listings.map((item) =>
          ensureSavedListingMetrics({
            KV,
            key: env.GOOGLE_MAPS_API_KEY,
            listing: item,
          })
        )
      );
    }
    const publicListings = await Promise.all(
      listings.map(async (item) => {
        let weeklyReport = null;
        if (item?.placeId && item?.competitorPlaceId) {
          try {
            weeklyReport = await getWeeklyReport({
              KV,
              myPlaceId: item.placeId,
              lang,
            });
          } catch {
            weeklyReport = null;
          }
        }
        return publicSavedListing(item, { origin, lang, weeklyReport });
      })
    );
    return json({
      ok: true,
      listings: publicListings,
    });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json(
        { ok: false, error: "INVALID_JSON", message: t(lang, "Invalid JSON body.", "JSON の形式が正しくありません。") },
        400
      );
    }

    if (!isValidEmail(body?.email)) {
      return json(
        {
          ok: false,
          error: "VALID_EMAIL_REQUIRED",
          message: t(lang, "Enter a valid email address.", "有効なメールアドレスを入力してください。"),
        },
        400
      );
    }

    if (!body?.placeId || !body?.competitorPlaceId) {
      return json(
        {
          ok: false,
          error: "PLACE_AND_COMPETITOR_REQUIRED",
          message: t(
            lang,
            "placeId and competitorPlaceId are required.",
            "placeId と competitorPlaceId は必須です。"
          ),
        },
        400
      );
    }

    let listing = await upsertSavedListing({ KV, payload: body });

    await KV.put(
      `comp:${listing.placeId}`,
      JSON.stringify({
        competitorPlaceId: listing.competitorPlaceId,
        setAt: Date.now(),
      })
    );

    let snapshotStatus = null;
    if (env?.GOOGLE_MAPS_API_KEY) {
      try {
        snapshotStatus = await runDailyForPlace({
          KV,
          key: env.GOOGLE_MAPS_API_KEY,
          myPlaceId: listing.placeId,
        });
      } catch (error) {
        snapshotStatus = {
          ok: false,
          error: error?.message || String(error),
        };
      }

      try {
        listing =
          (await refreshSavedListingMetrics({
            KV,
            key: env.GOOGLE_MAPS_API_KEY,
            listing,
          })) || listing;
      } catch {
        // Keep the save flow resilient even if change tracking fails.
      }
    }

    return json({
      ok: true,
      listing: publicSavedListing(listing, { origin, lang }),
      snapshotStatus,
      message: lang === "ja"
        ? "店舗を保存しました。保存済み店舗からいつでも再表示できます。"
        : "Listing saved. You can reopen it anytime from Saved Listings.",
    });
  }

  if (request.method === "DELETE") {
    const id = (url.searchParams.get("id") || "").trim();
    const email = (url.searchParams.get("email") || "").trim();

    if (!id || !isValidEmail(email)) {
      return json(
        {
          ok: false,
          error: "ID_AND_EMAIL_REQUIRED",
          message: t(
            lang,
            "id and valid email are required.",
            "id と有効なメールアドレスが必要です。"
          ),
        },
        400
      );
    }

    const removed = await deleteSavedListing({ KV, id, email });
    if (!removed.ok) {
      return json(
        {
          ok: false,
          error: removed.code,
          message:
            removed.code === "FORBIDDEN"
              ? t(lang, "You do not have permission to delete this saved listing.", "この保存済み店舗を削除する権限がありません。")
              : t(lang, "Saved listing not found.", "保存済み店舗が見つかりません。"),
        },
        removed.code === "FORBIDDEN" ? 403 : 404
      );
    }

    return json({
      ok: true,
      id,
      message: t(lang, "Saved listing deleted.", "保存済み店舗を削除しました。"),
    });
  }

  return json(
    { ok: false, error: "METHOD_NOT_ALLOWED", message: t(lang, "Method not allowed.", "許可されていないメソッドです。") },
    405
  );
}
