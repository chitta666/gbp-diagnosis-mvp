import { buildWeeklyEmail, sendEmailNotification } from "../_lib/email.js";
import { runDailyForPlace } from "../_lib/runDaily.js";
import {
  buildReviewDropSignal,
  buildDeepLink,
  listAllSavedListings,
  patchSavedListing,
  refreshSavedListingMetrics,
  refreshSavedListingReviewThemeHistory,
} from "../_lib/savedListings.js";
import { getWeeklyReport } from "../_lib/weeklyReport.js";

const WEEKLY_INTERVAL_MS = 6.5 * 24 * 60 * 60 * 1000;

function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function canSendWeekly(lastWeeklySentAt) {
  if (!lastWeeklySentAt) return true;
  const ts = Date.parse(lastWeeklySentAt);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts >= WEEKLY_INTERVAL_MS;
}

function makeSummaryLines(report, lang = "en") {
  const collecting = isJapanese(lang) ? "データ収集中" : "Collecting data";
  return [
    isJapanese(lang)
      ? `今週の自店舗レビュー増加: ${report.my?.weeklyGain ?? collecting}`
      : `Your weekly review growth: ${report.my?.weeklyGain ?? collecting}`,
    isJapanese(lang)
      ? `今週の競合レビュー増加: ${report.competitor?.weeklyGain ?? collecting}`
      : `Competitor weekly review growth: ${report.competitor?.weeklyGain ?? collecting}`,
    isJapanese(lang)
      ? `週間レビュー増減差: ${report.weeklyGainDiff ?? collecting}`
      : `Weekly growth difference: ${report.weeklyGainDiff ?? collecting}`,
    isJapanese(lang)
      ? `総レビュー差: ${report.totalDiff ?? collecting}`
      : `Total review difference: ${report.totalDiff ?? collecting}`,
  ];
}

function buildEmailInsight({ report, reviewDropSignal, lang = "en" }) {
  if (reviewDropSignal?.visible && Number.isFinite(reviewDropSignal?.dropCount)) {
    return [
      isJapanese(lang)
        ? `前回の保存チェック以降、レビュー件数が ${reviewDropSignal.dropCount} 件減っています。`
        : `Review count dropped by ${reviewDropSignal.dropCount} since the last saved check.`,
      reviewDropSignal.customerImpact ||
        (isJapanese(lang)
          ? "見た目の信頼感が以前より弱くなっている可能性があります。"
          : "Visible trust may be weaker than before."),
      report?.insight || "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return report?.insight || (isJapanese(lang) ? "週次GBPレポートの準備ができました。" : "Your weekly GBP report is ready.");
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const secret = env?.NOTIFICATION_SECRET;
  const url = new URL(request.url);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dryRun = body?.dryRun === true

  if (!secret) {
    return json(
      {
        ok: false,
        error: "NOTIFICATION_SECRET_NOT_CONFIGURED",
        message: "Set NOTIFICATION_SECRET before running saved-listing processing.",
      },
      500
    );
  }

  if (token !== secret) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const KV = env?.KV;
  const key = env?.GOOGLE_MAPS_API_KEY;
  if (!KV || !key) {
    return json({ ok: false, error: "NO_KV_OR_KEY" }, 500);
  }

  const listings = await listAllSavedListings({ KV });
  const origin = env?.APP_BASE_URL || url.origin;
  const dailyCache = new Map();
  const weeklyCache = new Map();

  const summary = {
    ok: true,
    dryRun,
    processed: 0,
    snapshotsSaved: 0,
    reviewThemeSnapshotsSaved: 0,
    reviewDropsDetected: 0,
    emailsSent: 0,
    emailSkipped: 0,
    waitingForHistory: 0,
    skippedRecentSend: 0,
    errors: [],
  };

  for (const listing of listings) {
    summary.processed += 1;

    try {
      if (!listing?.placeId || !listing?.competitorPlaceId) {
        summary.errors.push({
          id: listing?.id ?? null,
          error: "MISSING_PLACE_OR_COMPETITOR",
        });
        continue;
      }

      await KV.put(
        `comp:${listing.placeId}`,
        JSON.stringify({
          competitorPlaceId: listing.competitorPlaceId,
          setAt: Date.now(),
        })
      );

      const dailyKey = `${listing.placeId}:${listing.competitorPlaceId}`;
      let dailyResult = dailyCache.get(dailyKey);
      if (!dailyResult) {
        dailyResult = await runDailyForPlace({
          KV,
          key,
          myPlaceId: listing.placeId,
        });
        dailyCache.set(dailyKey, dailyResult);
      }

      if (dailyResult?.ok) {
        summary.snapshotsSaved += 1;
        const updatedListing =
          (await refreshSavedListingMetrics({
            KV,
            key,
            listing,
          })) || listing;
        const previousOwnSnapshotAt =
          updatedListing?.reviewThemeHistory?.own?.[0]?.capturedAt ?? null;
        const previousCompetitorSnapshotAt =
          updatedListing?.reviewThemeHistory?.competitor?.[0]?.capturedAt ?? null;
        const reviewThemeUpdatedListing =
          (await refreshSavedListingReviewThemeHistory({
            KV,
            key,
            listing: updatedListing,
          })) || updatedListing;
        const nextCapturedAt = reviewThemeUpdatedListing?.lastReviewThemeCapturedAt ?? null;
        if (
          nextCapturedAt &&
          reviewThemeUpdatedListing?.reviewThemeHistory?.own?.[0]?.capturedAt === nextCapturedAt &&
          previousOwnSnapshotAt !== nextCapturedAt
        ) {
          summary.reviewThemeSnapshotsSaved += 1;
        }
        if (
          nextCapturedAt &&
          reviewThemeUpdatedListing?.reviewThemeHistory?.competitor?.[0]?.capturedAt ===
            nextCapturedAt &&
          previousCompetitorSnapshotAt !== nextCapturedAt
        ) {
          summary.reviewThemeSnapshotsSaved += 1;
        }

        await patchSavedListing({
          KV,
          id: listing.id,
          patch: { lastDailyRunAt: new Date().toISOString() },
        });

        Object.assign(listing, reviewThemeUpdatedListing, {
          lastDailyRunAt: new Date().toISOString(),
        });
      }

      const lang = String(listing?.preferredLanguage || "en").trim().toLowerCase() === "ja" ? "ja" : "en";
      const reviewDropSignal = buildReviewDropSignal(listing, { lang });
      if (reviewDropSignal?.visible) {
        summary.reviewDropsDetected += 1;
      }

      const weeklyKey = `${listing.placeId}:${lang}`;
      let weeklyReport = weeklyCache.get(weeklyKey);
      if (!weeklyReport) {
        weeklyReport = await getWeeklyReport({ KV, myPlaceId: listing.placeId, lang });
        weeklyCache.set(weeklyKey, weeklyReport);
      }

      if (weeklyReport.status !== "ready") {
        summary.waitingForHistory += 1;
        continue;
      }

      if (!canSendWeekly(listing.lastWeeklySentAt)) {
        summary.skippedRecentSend += 1;
        continue;
      }

      if (dryRun) {
        summary.emailSkipped += 1;
        continue;
      }

      const emailPayload = buildWeeklyEmail({
        listingName:
          listing.name ||
          weeklyReport.my?.placeId ||
          (isJapanese(lang) ? "保存した店舗" : "Saved Listing"),
        insight: buildEmailInsight({ report: weeklyReport, reviewDropSignal, lang }),
        summaryLines: makeSummaryLines(weeklyReport, lang),
        deepLink: buildDeepLink({ origin, id: listing.id }),
        weekAgo: weeklyReport.weekAgo,
        today: weeklyReport.today,
        lang,
      });

      const sent = await sendEmailNotification({
        env,
        to: listing.email,
        ...emailPayload,
      });

      if (!sent.ok) {
        if (sent.skipped) {
          summary.emailSkipped += 1;
        } else {
          summary.errors.push({
            id: listing.id,
            error: sent.message || sent.reason || "EMAIL_FAILED",
          });
        }
        continue;
      }

      summary.emailsSent += 1;
      await patchSavedListing({
        KV,
        id: listing.id,
        patch: { lastWeeklySentAt: new Date().toISOString() },
      });
    } catch (error) {
      summary.errors.push({
        id: listing?.id ?? null,
        error: error?.message || String(error),
      });
    }
  }

  return json(summary);
}
