import comp from "../_lib/competitors.js";

export async function onRequest({ request, env }) {
  try {
    const key = env?.GOOGLE_MAPS_API_KEY;
    if (!key) return new Response("NO_KEY", { status: 500 });

    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response("BAD_LATLNG", { status: 400 });
    }

    // ここで「本当に関数か」確認（ここで落ちるなら import 問題）
    if (typeof comp?.fetchCompetitorsAutoRadius !== "function") {
      return new Response(
        "BAD_IMPORT: " + JSON.stringify(Object.keys(comp ?? {})),
        { status: 500 }
      );
    }

    const competitors = await comp.fetchCompetitorsAutoRadius({ key, lat, lng, type: "restaurant" });

    return new Response(JSON.stringify({ ok: true, competitors }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(
      "CRASH:\n" + (e?.stack || e?.message || String(e)),
      { status: 500 }
    );
  }
}