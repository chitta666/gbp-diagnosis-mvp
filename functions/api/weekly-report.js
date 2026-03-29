import { getWeeklyReport } from "../_lib/weeklyReport.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const url = new URL(request.url);
  const myPlaceId = (url.searchParams.get("my") || "").trim();

  if (!myPlaceId) {
    return json(
      { ok: false, code: "BAD_REQUEST", message: "A place ID is required." },
      400
    );
  }

  const KV = env?.KV;
  if (!KV) {
    return json(
      {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Weekly report data is temporarily unavailable.",
      },
      500
    );
  }

  const report = await getWeeklyReport({ KV, myPlaceId });
  return json(report);
}
