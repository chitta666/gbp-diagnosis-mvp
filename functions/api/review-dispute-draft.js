import { buildReviewDisputeDrafts } from "../_lib/reviewDispute.js";

function resolveLang(request, body = null) {
  const explicit = String(body?.lang || "").trim().toLowerCase();
  if (explicit === "ja" || explicit === "en") return explicit;

  const acceptLanguage = String(request.headers.get("accept-language") || "").toLowerCase();
  return acceptLanguage.includes("ja") ? "ja" : "en";
}

function t(lang, en, ja) {
  return lang === "ja" ? ja : en;
}

export async function onRequest({ request }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  let body;
  let lang = resolveLang(request);
  try {
    body = await request.json();
    lang = resolveLang(request, body);
  } catch {
    return json(
      { ok: false, error: "INVALID_JSON", message: t(lang, "Invalid JSON body.", "JSON の形式が正しくありません。") },
      400
    );
  }

  try {
    const drafted = buildReviewDisputeDrafts(body);
    if (!drafted.ok) {
      return json(drafted, 400);
    }

    return json(drafted);
  } catch (error) {
    console.error("review dispute draft failed", error);
    return json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: t(
          lang,
          "Could not generate review dispute drafts right now.",
          "現在はレビュー削除アシスタントの下書きを生成できません。"
        ),
      },
      500
    );
  }
}
