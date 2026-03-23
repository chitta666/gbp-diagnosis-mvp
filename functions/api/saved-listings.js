import { runDailyForPlace } from "../_lib/runDaily.js";
import {
  deleteSavedListing,
  isValidEmail,
  listSavedListingsByEmail,
  publicSavedListing,
  refreshSavedListingMetrics,
  upsertSavedListing,
} from "../_lib/savedListings.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const KV = env?.KV;
  if (!KV) {
    return json({ ok: false, error: "NO_KV_BINDING" }, 500);
  }

  const origin = new URL(request.url).origin;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const email = (url.searchParams.get("email") || "").trim();
    if (!isValidEmail(email)) {
      return json({ ok: false, error: "VALID_EMAIL_REQUIRED" }, 400);
    }

    const listings = await listSavedListingsByEmail({ KV, email });
    return json({
      ok: true,
      listings: listings.map((item) => publicSavedListing(item, { origin })),
    });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "INVALID_JSON" }, 400);
    }

    if (!isValidEmail(body?.email)) {
      return json({ ok: false, error: "VALID_EMAIL_REQUIRED" }, 400);
    }

    if (!body?.placeId || !body?.competitorPlaceId) {
      return json(
        { ok: false, error: "placeId and competitorPlaceId are required" },
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
      listing: publicSavedListing(listing, { origin }),
      snapshotStatus,
      message:
        "Listing saved. You can reopen it anytime from Saved Listings.",
    });
  }

  if (request.method === "DELETE") {
    const id = (url.searchParams.get("id") || "").trim();
    const email = (url.searchParams.get("email") || "").trim();

    if (!id || !isValidEmail(email)) {
      return json({ ok: false, error: "id and valid email are required" }, 400);
    }

    const removed = await deleteSavedListing({ KV, id, email });
    if (!removed.ok) {
      return json({ ok: false, error: removed.code }, removed.code === "FORBIDDEN" ? 403 : 404);
    }

    return json({ ok: true, id });
  }

  return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
}
